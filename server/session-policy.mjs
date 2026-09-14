export const SESSION_IDLE_MS = 30 * 60 * 1000
export const SESSION_ABSOLUTE_MS = 8 * 60 * 60 * 1000

export function sessionOptions({ secret, store, secureCookie }) {
  return {
    name: 'kaam.sid', secret, store, resave: false, saveUninitialized: false, rolling: false,
    cookie: { httpOnly: true, sameSite: 'strict', secure: secureCookie, maxAge: null, path: '/' },
  }
}

export function startSession(session, userId, now = Date.now()) {
  session.userId = userId
  session.authenticatedAt = now
  session.lastActivityAt = now
}

export function sessionTiming(session, now = Date.now()) {
  const { authenticatedAt, lastActivityAt } = session || {}
  // Reject legacy sessions too: their original login time cannot be established.
  if (!session?.userId || !Number.isSafeInteger(authenticatedAt) || !Number.isSafeInteger(lastActivityAt)
    || authenticatedAt > now || lastActivityAt < authenticatedAt || lastActivityAt > now) return null
  const absoluteExpiresAt = authenticatedAt + SESSION_ABSOLUTE_MS
  const expiresAt = Math.min(lastActivityAt + SESSION_IDLE_MS, absoluteExpiresAt)
  if (now >= expiresAt) return null
  return { expiresAt, absoluteExpiresAt, idleTimeoutMs: SESSION_IDLE_MS, serverNow: now }
}

export function enforceSessionLifetime(req, _res, next) {
  if (req.session?.userId && !sessionTiming(req.session)) {
    // Regeneration destroys the expired server session before creating anonymous CSRF state.
    return req.session.regenerate(next)
  }
  next()
}

export function preventPrivateCaching(_req, res, next) {
  res.set('Cache-Control', 'private, no-store')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
}
