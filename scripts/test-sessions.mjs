import assert from 'node:assert/strict'
import { once } from 'node:events'
import { test } from 'node:test'
import express from 'express'
import session from 'express-session'
import { SESSION_ABSOLUTE_MS, SESSION_IDLE_MS, enforceSessionLifetime, preventPrivateCaching, sessionOptions, sessionTiming, startSession } from '../server/session-policy.mjs'

test('sesiones antiguas, fechas inválidas y cuentas anónimas no conceden acceso', () => {
  const now = 1_800_000_000_000
  for (const candidate of [null, {}, { userId: 'legacy' },
    { userId: 'a', authenticatedAt: now + 1, lastActivityAt: now },
    { userId: 'a', authenticatedAt: now, lastActivityAt: now - 1 },
    { userId: 'a', authenticatedAt: now, lastActivityAt: 'now' },
  ]) assert.equal(sessionTiming(candidate, now), null)
})

test('caduca a los 30 minutos incluso con consultas periódicas', () => {
  const started = 1_800_000_000_000
  const stored = {}
  startSession(stored, 'operator', started)
  for (let elapsed = 0; elapsed < SESSION_IDLE_MS; elapsed += 15_000) {
    assert.equal(sessionTiming(stored, started + elapsed).expiresAt, started + SESSION_IDLE_MS)
  }
  assert.equal(sessionTiming(stored, started + SESSION_IDLE_MS), null)
})

test('la actividad renueva la inactividad pero nunca supera ocho horas desde el login', () => {
  const started = 1_800_000_000_000
  const stored = {}
  startSession(stored, 'operator', started)
  for (let elapsed = 60_000; elapsed < SESSION_ABSOLUTE_MS; elapsed += 60_000) {
    const now = started + elapsed
    assert.ok(sessionTiming(stored, now))
    stored.lastActivityAt = now
    assert.equal(sessionTiming(stored, now).expiresAt, Math.min(now + SESSION_IDLE_MS, started + SESSION_ABSOLUTE_MS))
  }
  assert.equal(sessionTiming(stored, started + SESSION_ABSOLUTE_MS), null)
})

test('HTTP: cookie de navegador, polling sin renovación y revocación de sesiones caducadas', async (t) => {
  // Isolated in-memory fixture: no production database, users or workflow commands.
  const store = new session.MemoryStore()
  const app = express()
  let sessionId
  app.use(preventPrivateCaching)
  app.use(session(sessionOptions({ secret: 'isolated-session-test-secret-at-least-32-characters', store, secureCookie: false })))
  app.use(enforceSessionLifetime)
  app.post('/login', (req, res) => {
    req.session.regenerate((error) => {
      if (error) throw error
      startSession(req.session, 'test-operator')
      sessionId = req.sessionID
      res.json({ timing: sessionTiming(req.session) })
    })
  })
  app.get('/private', (req, res) => {
    const timing = sessionTiming(req.session)
    res.status(timing ? 200 : 401).json({ timing })
  })
  app.get('/session', (req, res) => {
    req.session.csrfToken ||= 'test-csrf'
    res.json({ timing: sessionTiming(req.session) })
  })
  app.post('/logout', (req, res) => req.session.destroy(() => res.status(204).end()))
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => { server.closeAllConnections(); server.close(); store.clear(() => {}) })
  const base = `http://127.0.0.1:${server.address().port}`
  const login = async () => {
    const response = await fetch(`${base}/login`, { method: 'POST' })
    const cookie = response.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly/)
    assert.match(cookie, /SameSite=Strict/)
    assert.doesNotMatch(cookie, /Expires=|Max-Age=/i)
    return { cookie: cookie.split(';')[0], timing: (await response.json()).timing }
  }
  const access = (cookie, path = '/private') => fetch(`${base}${path}`, { headers: { Cookie: cookie } })
  const getStored = () => new Promise((resolve, reject) => store.get(sessionId, (error, value) => error ? reject(error) : resolve(value)))
  const saveStored = (value) => new Promise((resolve, reject) => store.set(sessionId, value, (error) => error ? reject(error) : resolve()))

  let signedIn = await login()
  for (const path of ['/session', '/private', '/session']) {
    const response = await access(signedIn.cookie, path)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('cache-control'), /no-store/)
    assert.equal(response.headers.get('set-cookie'), null)
    assert.equal((await response.json()).timing.expiresAt, signedIn.timing.expiresAt)
  }
  const idle = await getStored()
  idle.authenticatedAt = Date.now() - SESSION_IDLE_MS - 1
  idle.lastActivityAt = idle.authenticatedAt
  await saveStored(idle)
  let response = await access(signedIn.cookie)
  assert.equal(response.status, 401)
  assert.match(response.headers.get('cache-control'), /no-store/)
  assert.equal(await getStored(), undefined)

  signedIn = await login()
  const absolute = await getStored()
  absolute.authenticatedAt = Date.now() - SESSION_ABSOLUTE_MS - 1
  absolute.lastActivityAt = Date.now()
  await saveStored(absolute)
  assert.equal((await access(signedIn.cookie)).status, 401)

  signedIn = await login()
  const legacy = await getStored()
  delete legacy.authenticatedAt
  delete legacy.lastActivityAt
  await saveStored(legacy)
  response = await access(signedIn.cookie, '/session')
  assert.equal((await response.json()).timing, null)
  assert.notEqual(response.headers.get('set-cookie')?.split(';')[0], signedIn.cookie)
  assert.equal(await getStored(), undefined)

  signedIn = await login()
  await fetch(`${base}/logout`, { method: 'POST', headers: { Cookie: signedIn.cookie } })
  assert.equal((await access(signedIn.cookie)).status, 401)
  assert.equal(sessionOptions({ secureCookie: true }).cookie.secure, true)
})
