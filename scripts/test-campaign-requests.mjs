import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import ts from 'typescript'
import { CAMPAIGN_REQUEST_TIMEOUT_MS, CAMPAIGN_WEBHOOK_TIMEOUT_MS } from '../shared/campaign-timeouts.mjs'

const compile = source => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64')
const authUrl = compile(await readFile(new URL('../src/auth.ts', import.meta.url), 'utf8'))
const { request, SESSION_FAILURE_EVENT } = await import(authUrl)
const workflowSource = (await readFile(new URL('../src/workflowApi.ts', import.meta.url), 'utf8'))
  .replace("'./auth'", JSON.stringify(authUrl))
  .replace("'../shared/campaign-timeouts.mjs'", JSON.stringify(new URL('../shared/campaign-timeouts.mjs', import.meta.url).href))
const { createWorkflowApi } = await import(compile(workflowSource))
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
function sessionEvents(t) {
  const events = []
  const previous = globalThis.window
  globalThis.window = { dispatchEvent: event => events.push(event) }
  t.after(() => { globalThis.window = previous })
  return events
}

for (const status of [500, 502, 503, 504]) test(`HTTP ${status} preserves the authenticated interface`, async t => {
  const events = sessionEvents(t)
  t.mock.method(globalThis, 'fetch', async () => json({ code: 'UPSTREAM_ERROR', message: 'Error de campaña' }, status))
  await assert.rejects(request('/api/workflows/campaigns/launch'), { status, message: 'Error de campaña' })
  assert.equal(events.length, 0)
})
for (const [status, code] of [[401, 'SESSION_EXPIRED'], [403, 'INVALID_CSRF']]) test(`${code} still locks private views`, async t => {
  const events = sessionEvents(t)
  t.mock.method(globalThis, 'fetch', async () => json({ code }, status))
  await assert.rejects(request('/api/workflows/config'), { code })
  assert.equal(events.length, 1)
  assert.equal(events[0].type, SESSION_FAILURE_EVENT)
})
test('network and malformed responses remain operation errors', async t => {
  const events = sessionEvents(t)
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('offline') })
  await assert.rejects(request('/api/workflows/config'), { code: 'NETWORK_ERROR' })
  t.mock.method(globalThis, 'fetch', async () => new Response('<html>Gateway failure</html>', { status: 502 }))
  await assert.rejects(request('/api/workflows/config'), { code: 'INVALID_RESPONSE' })
  assert.equal(events.length, 0)
})
test('request deadline produces a local timeout, not a session failure', async t => {
  const events = sessionEvents(t)
  t.mock.method(globalThis, 'fetch', (_path, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  }))
  // Keep the test process alive while AbortSignal's unref'ed deadline fires.
  const keepAlive = setTimeout(() => {}, 1000)
  try { await assert.rejects(request('/api/workflows/config', { timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' }) }
  finally { clearTimeout(keepAlive) }
  assert.equal(events.length, 0)
})
for (const product of ['ficharia', 'deca']) test(`${product}: 4,140 contacts, long acknowledgement and cancelled scope`, async t => {
  const events = sessionEvents(t)
  const timeouts = []
  t.mock.method(AbortSignal, 'timeout', ms => { timeouts.push(ms); return new AbortController().signal })
  const calls = []
  t.mock.method(globalThis, 'fetch', async (path, init) => {
    calls.push({ path, init })
    return json({ status: 'accepted' }, 202)
  })
  const scope = new AbortController()
  let pending = 0
  const api = createWorkflowApi(product, scope.signal, () => { pending++; return () => { pending-- } })
  const csv = 'email,empresa\n' + Array.from({ length: 4140 }, (_, i) => `contact${i}@example.invalid,Empresa ${i}`).join('\n')
  const form = new FormData()
  form.append('csv', new Blob([csv], { type: 'text/csv' }), '4140.csv')
  form.append('campaign_id', '7dbd5ec7-4a5a-4a8c-a824-80f0b1ab2c28')
  assert.equal((await api.launchCampaign(form, 'csrf-test')).status, 'accepted')
  assert.equal(timeouts[0], CAMPAIGN_REQUEST_TIMEOUT_MS)
  assert.ok(timeouts[0] > CAMPAIGN_WEBHOOK_TIMEOUT_MS)
  assert.equal(calls[0].path, `/api/products/${product}/workflows/campaigns/launch`)
  assert.equal(await calls[0].init.body.get('csv').text(), csv)
  assert.equal(calls[0].init.headers.get('X-CSRF-Token'), 'csrf-test')
  assert.equal(pending, 0)
  scope.abort()
  await assert.rejects(api.launchCampaign(form, 'csrf-test'))
  assert.equal(calls.length, 1)
  assert.equal(events.length, 0)
})

test('server forwards all contacts and the idempotency key to the webhook', async t => {
  const originalUrl = process.env.N8N_PROSPECTING_WEBHOOK_URL
  const originalMode = process.env.NODE_ENV
  process.env.N8N_PROSPECTING_WEBHOOK_URL = 'http://127.0.0.1/test-only'
  process.env.NODE_ENV = 'test'
  t.after(() => {
    if (originalUrl === undefined) delete process.env.N8N_PROSPECTING_WEBHOOK_URL
    else process.env.N8N_PROSPECTING_WEBHOOK_URL = originalUrl
    if (originalMode === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalMode
  })
  const { launchCampaign } = await import('../server/n8n-client.mjs')
  const csv = 'email\n' + Array.from({ length: 4140 }, (_, i) => `contact${i}@example.invalid`).join('\n')
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(await init.body.get('csv').text(), csv)
    assert.equal(init.body.get('campaign_id'), 'test-idempotent-campaign')
    return json({ status: 'accepted', accepted_contacts: 4140 }, 202)
  })
  assert.equal((await launchCampaign({ file: { buffer: Buffer.from(csv), originalname: '4140.csv' }, prompt: 'Contactar a todas las empresas', source: 'garaje-kaam', validContacts: 4140, campaign_id: 'test-idempotent-campaign' })).accepted_contacts, 4140)
  await assert.rejects(launchCampaign({ productId: 'deca' }), { code: 'PRODUCT_NOT_READY' })
})
