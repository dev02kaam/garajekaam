const products = [{ id: 'ficharia', schema: 'public', path: 'ficharia' }, { id: 'deca', schema: 'garaje_deca', path: 'dekaam' }]

export function createCampaignRecovery({ pool, env = process.env, fetchImpl = fetch, logger = console, setTimer = setTimeout, clearTimer = clearTimeout }) {
  const raw = env.N8N_BASE_URL?.trim() || env.N8N_PROSPECTING_WEBHOOK_URL?.trim()
  const token = env.N8N_WEBHOOK_AUTH_TOKEN?.trim()
  const base = raw ? new URL(raw) : null
  const enabled = env.KAAM_CAMPAIGN_RECOVERY_ENABLED !== 'false' && !!base && !!token
  if (base && (base.protocol !== 'https:' || base.username || base.password)) throw new Error('Recovery requires an HTTPS n8n origin without embedded credentials')
  let stopped = true, running = false, timer, lastPollAt = null, lastError = null
  const interval = Math.max(60_000, Number(env.KAAM_CAMPAIGN_RECOVERY_INTERVAL_MS) || 60_000)
  const status = () => ({ enabled, running, lastPollAt, lastError })

  async function poll() {
    if (!enabled || running) return { skipped: true }
    running = true
    let recovered = 0, checked = 0, failure = null
    try {
      for (const product of products) {
        try {
        const ready = await pool.query('SELECT to_regprocedure($1) IS NOT NULL AS ready', [product.schema + '.kaam_campaign_request_recovery(uuid,text)'])
        if (!ready.rows[0]?.ready) continue
        const { rows } = await pool.query(`SELECT c.campaign_id,r.owner FROM ${product.schema}.outbound_campaigns c
          LEFT JOIN ${product.schema}.kaam_campaign_runs r USING(campaign_id)
          WHERE c.status IN ('pending_plan','planning','segmenting','scheduled','sending')
          AND coalesce(r.expires_at,c.created_at+interval '10 minutes') < now()-interval '1 minute'
          AND extract(isodow FROM now() AT TIME ZONE c.timezone)<=5
          AND (now() AT TIME ZONE c.timezone)::time >= coalesce((c.config->>'default_window_start')::time,time '08:30')
          AND (now() AT TIME ZONE c.timezone)::time < coalesce((c.config->>'default_window_end')::time,time '17:00')
          AND NOT EXISTS(SELECT 1 FROM ${product.schema}.kaam_mailboxes b WHERE b.mailbox=lower(c.config->>'from_address') AND b.paused)
          AND NOT EXISTS(SELECT 1 FROM ${product.schema}.outbound_campaign_contacts x WHERE x.campaign_id=c.campaign_id AND x.status IN ('sending','segmenting') AND x.lease_expires_at>now())
          ORDER BY c.created_at LIMIT 3`)
        checked += rows.length
        if (!rows.length) continue
        const health = await fetchImpl(new URL('/healthz', base), { signal: AbortSignal.timeout(10_000), redirect: 'error' })
        if (!health.ok) throw new Error('N8N_UNAVAILABLE')
        for (const campaign of rows) {
          const { rows: requests } = await pool.query(`SELECT ${product.schema}.kaam_campaign_request_recovery($1::uuid,$2) AS result`, [campaign.campaign_id, campaign.owner])
          const request = requests[0]?.result
          if (!request?.requested) continue
          // No HTTP retries: a timeout can mean the new owner already accepted.
          const response = await fetchImpl(new URL('/webhook/' + product.path + '/campanas/recuperar', base), {
            method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ campaign_id: request.campaign_id, recovery_token: request.recovery_token }),
            signal: AbortSignal.timeout(25_000), redirect: 'error',
          })
          if (response.status !== 202 && response.status !== 409) throw new Error('RECOVERY_HTTP_' + response.status)
          const result = await response.json()
          if (response.status === 202 && result.accepted === true && result.campaign_id === campaign.campaign_id) {
            recovered++
            logger.info('Recuperación de campaña aceptada', { product: product.id, campaignId: campaign.campaign_id, executionId: result.execution_id })
          }
        }
        } catch (error) {
          failure = /^RECOVERY_HTTP_\d+$|^N8N_UNAVAILABLE$/.test(error.message) ? error.message : 'RECOVERY_CHECK_FAILED'
          logger.error('Comprobación de recuperación pendiente:', { product: product.id, code: failure })
        }
      }
      lastPollAt = new Date().toISOString(); lastError = failure
      return { checked, recovered, ...(failure ? { error: failure } : {}) }
    } catch (error) {
      lastPollAt = new Date().toISOString()
      lastError = /^RECOVERY_HTTP_\d+$|^N8N_UNAVAILABLE$/.test(error.message) ? error.message : 'RECOVERY_CHECK_FAILED'
      logger.error('Comprobación de recuperación pendiente:', lastError)
      return { checked, recovered, error: lastError }
    } finally { running = false }
  }
  const cycle = async () => { await poll(); if (!stopped) timer = setTimer(cycle, interval) }
  return {
    poll, status,
    start() { if (!stopped || !enabled) return; stopped = false; logger.info('Recuperación externa de campañas activa; las comprobaciones no ejecutan workflows.'); timer = setTimer(cycle, 10_000); timer.unref?.() },
    stop() { stopped = true; clearTimer(timer) },
  }
}
