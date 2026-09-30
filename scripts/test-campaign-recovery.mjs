import test from 'node:test'
import assert from 'node:assert/strict'
import { createCampaignRecovery } from '../server/campaign-recovery.mjs'

const env = { N8N_BASE_URL: 'https://n8n.example.test', N8N_WEBHOOK_AUTH_TOKEN: 'fixture-secret' }
function fixture({ candidate = false, product = 'public', granted = true, health = true, failPost = false } = {}) {
  const calls = [], queries = [], logs = []
  const pool = { async query(sql, args) {
    queries.push({ sql, args })
    if (sql.includes('to_regprocedure')) return { rows: [{ ready: true }] }
    if (sql.includes('LEFT JOIN')) return { rows: candidate && sql.includes('FROM ' + product + '.') ? [{ campaign_id: 'campaign', owner: 'old' }] : [] }
    return { rows: [{ result: { requested: granted, campaign_id: 'campaign', recovery_token: 'ticket' } }] }
  } }
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), options })
    if (url.pathname === '/healthz') return { ok: health }
    if (failPost) throw Error('Timeout fixture-secret ticket')
    return { status: 202, json: async () => ({ accepted: true, campaign_id: 'campaign', execution_id: 'new' }) }
  }
  const logger = { info: (...args) => logs.push(args), error: (...args) => logs.push(args) }
  return { recovery: createCampaignRecovery({ pool, env, fetchImpl, logger }), calls, queries, logs }
}
test('empty polls perform no HTTP requests or executions', async () => {
  const f = fixture(); assert.deepEqual(await f.recovery.poll(), { checked: 0, recovered: 0 }); assert.equal(f.calls.length, 0)
})
test('healthy candidate obtains a ticket before one authenticated production call', async () => {
  const f = fixture({ candidate: true }); assert.equal((await f.recovery.poll()).recovered, 1)
  assert.equal(f.calls.length, 2); assert.match(f.calls[1].url, /\/webhook\/ficharia\/campanas\/recuperar$/)
  assert.equal(f.calls[1].options.headers.Authorization, 'Bearer fixture-secret')
  assert.equal(f.queries.filter(q => q.sql.includes('AS result')).length, 1)
})
test('DEKAAM uses its own schema and webhook', async () => {
  const f = fixture({ candidate: true, product: 'garaje_deca' }); assert.equal((await f.recovery.poll()).recovered, 1)
  assert.match(f.calls[1].url, /\/webhook\/dekaam\/campanas\/recuperar$/)
  assert.match(f.queries.find(q => q.sql.includes('AS result')).sql, /garaje_deca/)
})
test('another owner winning the ticket causes no workflow execution', async () => {
  const f = fixture({ candidate: true, granted: false }); assert.equal((await f.recovery.poll()).recovered, 0); assert.equal(f.calls.length, 1)
})
test('unhealthy n8n does not fence the owner or create a ticket', async () => {
  const f = fixture({ candidate: true, health: false }); assert.equal((await f.recovery.poll()).error, 'N8N_UNAVAILABLE')
  assert.equal(f.queries.filter(q => q.sql.includes('AS result')).length, 0)
})
test('uncertain HTTP delivery is not retried and secrets stay out of logs', async () => {
  const f = fixture({ candidate: true, failPost: true }); assert.equal((await f.recovery.poll()).error, 'RECOVERY_CHECK_FAILED')
  assert.equal(f.calls.length, 2); assert.doesNotMatch(JSON.stringify(f.logs), /fixture-secret|ticket/)
})
test('missing configuration disables polling', async () => {
  const recovery = createCampaignRecovery({ pool: { query() { throw Error('must not query') } }, env: {} })
  assert.equal(recovery.status().enabled, false); assert.deepEqual(await recovery.poll(), { skipped: true })
})
test('overlapping polls do not compete', async () => {
  let release; const wait = new Promise(resolve => { release = resolve })
  const recovery = createCampaignRecovery({ env, pool: { async query() { await wait; return { rows: [{ ready: false }] } } } })
  const running = recovery.poll(); assert.deepEqual(await recovery.poll(), { skipped: true }); release(); await running
})
test('one product failing does not prevent the other product from being checked', async () => {
  let checkedDekaam = false
  const recovery = createCampaignRecovery({ env, logger: { error() {} }, pool: { async query(_sql, args) {
    if (args[0].startsWith('public.')) throw Error('unavailable')
    checkedDekaam = true; return { rows: [{ ready: false }] }
  } } })
  assert.equal((await recovery.poll()).error, 'RECOVERY_CHECK_FAILED'); assert.equal(checkedDekaam, true)
})
