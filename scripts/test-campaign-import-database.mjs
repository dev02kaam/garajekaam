import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, readdir, mkdtemp, writeFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { importCampaign } from '../server/campaign-import.mjs'

const url = process.env.BULK_TEST_DATABASE_URL
if (!url || new URL(url).pathname !== '/kaam_bulk_test' || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Use the disposable local kaam_bulk_test database')
const pool = new pg.Pool({ connectionString: url })
const dir = await mkdtemp(join(tmpdir(), 'kaam-import-test-'))
const migrationRoot = new URL('../../flujoficharia/sql/', import.meta.url)
try {
  for (const file of (await readdir(migrationRoot)).filter(f => /^0\d\d_.*\.sql$/.test(f)).sort()) {
    await pool.query(await readFile(new URL(file, migrationRoot), 'utf8'))
  }
  // DEKAAM uses the same reviewed migrations in its independent schema.
  const { initializeDekaam } = await import('../../flujoficharia/scripts/lib/dekaam-database.mjs')
  const previousCwd = process.cwd()
  const db = await pool.connect()
  try { process.chdir(fileURLToPath(new URL('../../flujoficharia/', import.meta.url))); await initializeDekaam(db) }
  finally { process.chdir(previousCwd); await db.query('SET search_path TO public,pg_catalog'); db.release() }
  const path = join(dir, 'contacts.csv')
  const csv = 'Email;Empresa;Provincia\n' + Array.from({ length: 12050 }, (_, i) => `company${i}@example.test;Empresa ${i};Castellón\n`).join('') + 'company0@example.test;Duplicado;X\nno-email;Error;X\n'
  await writeFile(path, csv)
  const file = { path, originalname: 'contacts.csv', size: (await stat(path)).size }
  const prompt = 'Contactar a todas las empresas durante la jornada laboral'
  const key = randomUUID()
  const first = await importCampaign({ pool, file, prompt, campaign_id: key })
  assert.equal(first.accepted_contacts, 12050)
  assert.deepEqual(first.skipped, { invalid_email: 1, duplicate_email: 1, opted_out: 0 })
  const repeat = await importCampaign({ pool, file, prompt, campaign_id: key })
  assert.equal(repeat.campaign_id, first.campaign_id); assert.equal(repeat.deduplicated, true)
  await assert.rejects(importCampaign({ pool, file, prompt: prompt + ' mañana', campaign_id: key }), { code: 'CAMPAIGN_CONFLICT' })
  const totals = (await pool.query('SELECT status,count(*)::int AS n,sum(send_attempt_count)::int AS attempts FROM outbound_campaign_contacts WHERE campaign_id=$1 GROUP BY status', [first.campaign_id])).rows
  assert.deepEqual(totals, [{ status: 'pending_segmentation', n: 12050, attempts: 0 }])
  const accepted = (await pool.query('SELECT kaam_campaign_accept_recovery($1,$2,$3) AS result', [first.campaign_id, first.recovery_token, 'test-only-execution'])).rows[0].result
  assert.equal(accepted.accepted, true)
  assert.equal((await pool.query('SELECT kaam_campaign_accept_recovery($1,$2,$3) AS result', [first.campaign_id, first.recovery_token, 'another-execution'])).rows[0].result.accepted, false)
  const deca = await importCampaign({ pool, file, prompt, campaign_id: key, productId: 'deca' })
  assert.notEqual(deca.campaign_id, first.campaign_id)
  assert.equal((await pool.query("SELECT config->>'from_address' AS sender FROM garaje_deca.outbound_campaigns WHERE campaign_id=$1", [deca.campaign_id])).rows[0].sender, 'deca@kaam.es')
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM public.outbound_campaign_contacts WHERE campaign_id=$1', [deca.campaign_id])).rows[0].n, 0)
  // Force a storage failure AFTER the first batch; nothing may become visible.
  const failedKey = randomUUID()
  const failingPool = { connect: async () => {
    const client = await pool.connect()
    return { release: () => client.release(), query: (text, values) => {
      if (text.startsWith('INSERT INTO "public".outbound_campaign_contacts')) throw new Error('simulated_storage_failure')
      return client.query(text, values)
    } }
  } }
  await assert.rejects(importCampaign({ pool: failingPool, file, prompt, campaign_id: failedKey }), /simulated_storage_failure/)
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM outbound_campaigns WHERE external_id=$1', [failedKey])).rows[0].n, 0)
  const realPath = process.env.LARGE_CSV_TEST_FILE
  if (realPath) {
    const started = Date.now()
    const real = await importCampaign({ pool, file: { path: realPath, originalname: basename(realPath), size: (await stat(realPath)).size }, prompt, campaign_id: randomUUID() })
    const count = (await pool.query('SELECT count(*)::int AS n,sum(send_attempt_count)::int AS attempts FROM outbound_campaign_contacts WHERE campaign_id=$1', [real.campaign_id])).rows[0]
    assert.equal(count.n, real.accepted_contacts); assert.equal(count.attempts, 0)
    console.log(JSON.stringify({ realFile: basename(realPath), accepted: real.accepted_contacts, skipped: real.skipped, seconds: (Date.now() - started) / 1000, emailsSent: 0 }))
  }
  console.log('OK: >10,000 contacts, atomic rollback, idempotency, conflict, one-use start ticket and product isolation; no external provider called.')
} finally {
  await pool.end()
  if (dirname(resolve(dir)) === resolve(tmpdir()) && basename(dir).startsWith('kaam-import-test-')) await rm(dir, { recursive: true, force: true })
}
