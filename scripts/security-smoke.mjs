import { randomBytes, randomUUID } from 'node:crypto'
import { closeDatabase, initializeDatabase, userQueries } from '../server/database.mjs'
import { hashPassword } from '../server/security.mjs'

const baseUrl = String(process.env.KAAM_TEST_BASE_URL || 'http://127.0.0.1:4174').replace(/\/$/, '')
const origin = String(process.env.KAAM_TEST_ORIGIN || 'http://localhost:5173').replace(/\/$/, '')
const expectSecureCookie = process.env.KAAM_TEST_SECURE_COOKIE === 'true'
const forwardedHttps = process.env.KAAM_TEST_FORWARDED_HTTPS === 'true'
const testUserId = randomUUID()
const testEmail = `security-smoke-${testUserId}@example.invalid`
const testPassword = randomBytes(32).toString('base64url')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function cookieFrom(response) {
  const setCookie = response.headers.getSetCookie?.()[0] || response.headers.get('set-cookie') || ''
  return { raw: setCookie, value: setCookie.split(';', 1)[0] }
}

async function request(path, { cookie = '', csrfToken = '', method = 'GET', body, requestOrigin = origin } = {}) {
  const headers = { Accept: 'application/json' }
  const isForm = body instanceof FormData
  if (cookie) headers.Cookie = cookie
  if (method !== 'GET') headers.Origin = requestOrigin
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  if (body && !isForm) headers['Content-Type'] = 'application/json'
  if (forwardedHttps) headers['X-Forwarded-Proto'] = 'https'
  return fetch(`${baseUrl}${path}`, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined })
}

try {
  await initializeDatabase()
  const now = new Date().toISOString()
  await userQueries.insert({
    id: testUserId,
    email: testEmail,
    displayName: 'Security Smoke Operator',
    role: 'operator',
    status: 'active',
    passwordHash: await hashPassword(testPassword),
    createdAt: now,
    updatedAt: now,
  })

  const sessionResponse = await request('/api/auth/session')
  assert(sessionResponse.status === 200, `La sesión inicial respondió ${sessionResponse.status}.`)
  const initialCookie = cookieFrom(sessionResponse)
  const sessionPayload = await sessionResponse.json()
  assert(initialCookie.value.startsWith('kaam.sid='), 'No se emitió la cookie de sesión esperada.')
  assert(/HttpOnly/i.test(initialCookie.raw), 'La cookie no incluye HttpOnly.')
  assert(/SameSite=Strict/i.test(initialCookie.raw), 'La cookie no incluye SameSite=Strict.')
  assert(!expectSecureCookie || /;\s*Secure/i.test(initialCookie.raw), 'La cookie de producción no incluye Secure.')
  assert(typeof sessionPayload.csrfToken === 'string' && sessionPayload.csrfToken.length > 20, 'No se emitió un token CSRF.')

  const invalidOrigin = await request('/api/auth/login', {
    cookie: initialCookie.value,
    csrfToken: sessionPayload.csrfToken,
    method: 'POST',
    requestOrigin: 'https://invalid.example',
    body: { email: testEmail, password: testPassword },
  })
  assert(invalidOrigin.status === 403, `Un origen no permitido respondió ${invalidOrigin.status}.`)

  const loginResponse = await request('/api/auth/login', {
    cookie: initialCookie.value,
    csrfToken: sessionPayload.csrfToken,
    method: 'POST',
    body: { email: testEmail, password: testPassword },
  })
  assert(loginResponse.status === 200, `El login de prueba respondió ${loginResponse.status}.`)
  const authenticatedCookie = cookieFrom(loginResponse)
  const loginPayload = await loginResponse.json()
  assert(authenticatedCookie.value.startsWith('kaam.sid='), 'El login no rotó la cookie de sesión.')
  assert(loginPayload.user?.role === 'operator', 'El servidor no devolvió el rol Operador.')

  const forbiddenUsers = await request('/api/users', { cookie: authenticatedCookie.value })
  assert(forbiddenUsers.status === 403, `Un Operador pudo consultar usuarios (${forbiddenUsers.status}).`)

  const campaignForm = new FormData()
  campaignForm.append('csv', new Blob(['email,empresa\nsmoke@example.invalid,Smoke\n'], { type: 'text/csv' }), 'smoke.csv')
  campaignForm.append('prompt', 'Prueba de seguridad sin envío')
  campaignForm.append('source', 'garaje-kaam')
  campaignForm.append('validContacts', '1')
  const missingCampaignCsrf = await request('/api/workflows/campaigns/launch', {
    cookie: authenticatedCookie.value,
    method: 'POST',
    body: campaignForm,
  })
  assert(missingCampaignCsrf.status === 403, `El comando de campaña sin CSRF respondió ${missingCampaignCsrf.status}.`)

  const protectedCampaign = await request('/api/workflows/campaigns/launch', {
    cookie: authenticatedCookie.value,
    csrfToken: loginPayload.csrfToken,
    method: 'POST',
    body: campaignForm,
  })
  assert(protectedCampaign.status === 503, `El proxy sin webhook configurado respondió ${protectedCampaign.status}.`)

  const missingCsrf = await request('/api/auth/logout', { cookie: authenticatedCookie.value, method: 'POST' })
  assert(missingCsrf.status === 403, `Una mutación sin CSRF respondió ${missingCsrf.status}.`)

  const logoutResponse = await request('/api/auth/logout', {
    cookie: authenticatedCookie.value,
    csrfToken: loginPayload.csrfToken,
    method: 'POST',
  })
  assert(logoutResponse.status === 204, `El cierre de sesión respondió ${logoutResponse.status}.`)

  const expiredAccess = await request('/api/users', { cookie: authenticatedCookie.value })
  assert(expiredAccess.status === 401, `La sesión cerrada conservó acceso (${expiredAccess.status}).`)

  console.log('Seguridad verificada: cookie, CSRF, origen, rol Operador, proxy de campañas y revocación de sesión.')
} finally {
  await userQueries.deleteSessionsForUser(testUserId)
  await userQueries.delete(testUserId)
  await closeDatabase()
}
