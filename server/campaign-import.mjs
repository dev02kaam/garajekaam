import { createReadStream, readFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import { basename } from 'node:path'
import { CampaignCsvReader, CsvError } from '../shared/campaign-csv.mjs'
import { campaignImportPolicy as limits } from '../shared/campaign-import-policy.mjs'
import { campaignPolicy } from '../shared/campaign-policy.mjs'
import { productConfiguration, resolveProduct } from './products.mjs'

const profiles = JSON.parse(readFileSync(new URL('../shared/campaign-ingestion-config.json', import.meta.url), 'utf8'))
const failure = (status, code, message) => Object.assign(new Error(message), { status, code })

async function* readContacts(path, parser, signal, hash) {
  for await (const bytes of createReadStream(path, { highWaterMark: 64 * 1024, signal })) {
    signal?.throwIfAborted()
    hash?.update(bytes)
    yield parser.push(bytes)
  }
  yield parser.finish()
}

export async function importCampaign({ pool, file, prompt, campaign_id, productId = 'ficharia', schema = 'public', signal }) {
  resolveProduct(productId, 'campaigns')
  const product = productConfiguration(productId, schema)
  if (!/^[a-z_][a-z0-9_]*$/i.test(product.schema)) throw new Error('Invalid campaign schema')
  const s = '"' + product.schema + '"'
  const configured = profiles[productId]
  if (!configured) throw failure(503, 'IMPORT_NOT_CONFIGURED', 'Falta la configuración de importación de este producto.')
  const externalId = campaign_id || randomUUID()
  const cleanPrompt = prompt.trim()
  if (Buffer.byteLength(cleanPrompt, 'utf8') < 8 || Buffer.byteLength(cleanPrompt, 'utf8') > 4000) throw new CsvError('La instrucción debe tener entre 8 y 4.000 bytes de texto.')
  // Validate the ENTIRE file before opening a transaction; no contact becomes
  // visible or sendable if a malformed row occurs at the very end of the upload.
  const preflight = new CampaignCsvReader()
  const hash = createHash('sha256').update('large-csv-v1\n' + productId + '\n' + cleanPrompt + '\n')
  for await (const contacts of readContacts(file.path, preflight, signal, hash)) void contacts
  const summary = preflight.summary()
  const requestHash = hash.digest('hex')
  // Avoid retaining two email deduplication sets during ingestion.
  preflight.seen.clear()
  const client = await pool.connect()
  let committed = false
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL search_path TO ${s}, pg_catalog`)
    const ready = await client.query('SELECT to_regprocedure($1) IS NOT NULL AS ready', [product.schema + '.kaam_campaign_accept_recovery(uuid,uuid,text)'])
    if (!ready.rows[0]?.ready) throw failure(503, 'IMPORT_NOT_READY', 'Falta instalar la recuperación de campañas (migración 025 y webhook) antes de importar listas grandes.')
    const lock = await client.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1,0)) AS owned', ['large-csv:' + product.schema + ':' + externalId])
    if (!lock.rows[0]?.owned) throw failure(409, 'IMPORT_IN_PROGRESS', 'Esta campaña ya se está importando. Espera y consulta el historial.')
    const existing = (await client.query(`SELECT campaign_id,request_hash,status,accepted_contacts FROM ${s}.outbound_campaigns WHERE external_id=$1`, [externalId])).rows[0]
    if (existing) {
      if (existing.request_hash !== requestHash) throw failure(409, 'CAMPAIGN_CONFLICT', 'El identificador ya pertenece a otro CSV o instrucción.')
      await client.query('COMMIT'); committed = true
      return { accepted: true, deduplicated: true, product_id: productId, campaign_id: existing.campaign_id, external_id: externalId, status: existing.status, accepted_contacts: existing.accepted_contacts, skipped: summary.skipped }
    }
    const config = { ...configured, product_id: productId,
      max_emails_per_day: campaignPolicy.max_emails_per_day,
      max_emails_per_hour: campaignPolicy.max_emails_per_hour,
      max_sends_per_run: campaignPolicy.max_sends_per_run,
      default_window_start: campaignPolicy.business_window_start,
      default_window_end: campaignPolicy.business_window_end,
      timezone: campaignPolicy.timezone,
    }
    const execution = 'csv-import:' + externalId
    let campaignId, batch = [], inserted = 0
    const flush = async () => {
      if (!batch.length) return
      signal?.throwIfAborted()
      if (!campaignId) {
        // Reuse the established sender validation, registration and product
        // guards with a bounded first batch, inside this same transaction.
        const result = (await client.query(`SELECT ${s}.ficharia_campaign_enqueue(${s}.kaam_ficharia_payload($1::jsonb)) AS result`, [JSON.stringify({
          product_id: productId, ingest_key: execution, external_id: externalId,
          source_filename: basename(file.originalname).slice(0, 255), prompt: cleanPrompt,
          workflow_execution_id: execution, config, contacts: batch,
        })])).rows[0].result
        if (!result.accepted || result.deduplicated) throw failure(409, 'CAMPAIGN_CONFLICT', 'Ya existe una campaña con ese identificador.')
        campaignId = result.campaign_id
        inserted += Number(result.accepted_contacts)
      } else {
        const result = await client.query(`INSERT INTO ${s}.outbound_campaign_contacts(campaign_id,email_normalized,contact_data)
          SELECT $1::uuid,contact->>'email',contact FROM jsonb_array_elements($2::jsonb) AS x(contact)
          WHERE ${s}.ficharia_valid_email(contact->>'email')
          ON CONFLICT(campaign_id,email_normalized) DO NOTHING`, [campaignId, JSON.stringify(batch)])
        inserted += result.rowCount
      }
      batch = []
    }
    const parser = new CampaignCsvReader()
    for await (const contacts of readContacts(file.path, parser, signal)) {
      for (const contact of contacts) { batch.push(contact); if (batch.length === limits.batchSize) await flush() }
    }
    await flush()
    if (!campaignId || inserted !== summary.valid) throw failure(422, 'IMPORT_COUNT_MISMATCH', 'La validación de la base de datos no coincide con el CSV; no se ha registrado la campaña.')
    await client.query(`UPDATE ${s}.outbound_campaigns SET request_hash=$2,accepted_contacts=$3,
      product_config=product_config||$4::jsonb WHERE campaign_id=$1`, [campaignId, requestHash, inserted, JSON.stringify({ import: { received_rows: summary.rows, accepted_contacts: inserted, skipped: summary.skipped, bytes: file.size } })])
    await client.query(`UPDATE ${s}.outbound_campaign_events SET metadata=metadata||$2::jsonb
      WHERE campaign_id=$1 AND event_type='campaign.enqueued'`, [campaignId, JSON.stringify({ accepted_contacts: inserted, received_rows: summary.rows, skipped: summary.skipped, import_mode: 'streamed' })])
    // A one-use durable ticket starts the already installed recovery entry point.
    // n8n receives only two UUIDs, never the large CSV or the contact array.
    const ticket = randomUUID()
    await client.query(`INSERT INTO ${s}.kaam_campaign_recovery_tickets(token,campaign_id,previous_owner) VALUES($1,$2,NULL)`, [ticket, campaignId])
    await client.query(`INSERT INTO ${s}.kaam_campaign_runs(campaign_id,owner,expires_at,wake_at)
      VALUES($1,$2,now()+interval '15 minutes',now())`, [campaignId, 'recovery:' + ticket])
    signal?.throwIfAborted()
    await client.query('COMMIT'); committed = true
    return { accepted: true, deduplicated: false, product_id: productId, campaign_id: campaignId,
      external_id: externalId, status: 'pending_plan', accepted_contacts: inserted,
      received_rows: summary.rows, skipped: summary.skipped, recovery_token: ticket }
  } finally {
    if (!committed) await client.query('ROLLBACK').catch(() => {})
    client.release()
  }
}
