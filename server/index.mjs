import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import session from 'express-session'
import sqliteStoreFactory from 'better-sqlite3-session-store'
import { csrfSync } from 'csrf-sync'
import { z } from 'zod'
import { db, userQueries } from './database.mjs'
import { hashPassword, verifyPassword } from './security.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 4174)
const sessionDurationMs = 8 * 60 * 60 * 1000
const secureCookie = process.env.SESSION_COOKIE_SECURE === undefined
  ? isProduction
  : process.env.SESSION_COOKIE_SECURE === 'true'

function loadSessionSecret() {
  if (process.env.SESSION_SECRET?.length >= 32) return process.env.SESSION_SECRET
  if (isProduction) throw new Error('SESSION_SECRET debe contener al menos 32 caracteres en producción.')

  const secretPath = resolve(projectRoot, 'data', '.session-secret')
  mkdirSync(dirname(secretPath), { recursive: true })
  if (existsSync(secretPath)) return readFileSync(secretPath, 'utf8').trim()

  const secret = randomBytes(48).toString('base64url')
  writeFileSync(secretPath, secret, { encoding: 'utf8', mode: 0o600 })
  return secret
}

const configuredOrigin = process.env.APP_ORIGIN?.replace(/\/$/, '')
if (isProduction && !configuredOrigin) throw new Error('APP_ORIGIN es obligatorio en producción.')

const allowedOrigins = new Set((isProduction
  ? [configuredOrigin]
  : [
      configuredOrigin,
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ]).filter(Boolean))

const connectSources = ["'self'", ...String(process.env.KAAM_CONNECT_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)]

const app = express()
app.disable('x-powered-by')
app.set('query parser', 'simple')
app.set('trust proxy', 'loopback')

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'"],
      connectSrc: connectSources,
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'no-referrer' },
}))
app.use(express.json({ limit: '32kb', strict: true }))

const SqliteStore = sqliteStoreFactory(session)
app.use(session({
  name: 'kaam.sid',
  secret: loadSessionSecret(),
  store: new SqliteStore({
    client: db,
    expired: { clear: true, intervalMs: 15 * 60 * 1000 },
  }),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'strict',
    secure: secureCookie,
    maxAge: sessionDurationMs,
    path: '/',
  },
}))

const { generateToken, revokeToken, csrfSynchronisedProtection } = csrfSync()

function verifyRequestOrigin(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
  const origin = req.get('origin')
  if (!origin || !allowedOrigins.has(origin)) {
    return res.status(403).json({ code: 'INVALID_ORIGIN', message: 'Origen de la solicitud no permitido.' })
  }
  next()
}

app.use('/api', verifyRequestOrigin)

function sessionUser(req) {
  if (!req.session.userId) return null
  const user = userQueries.findPublicById.get(req.session.userId)
  if (!user || user.status !== 'active') return null
  return user
}

function requireAuthentication(req, res, next) {
  const user = sessionUser(req)
  if (!user) {
    req.session.destroy(() => {})
    return res.status(401).json({ code: 'SESSION_EXPIRED', message: 'La sesión ha caducado.' })
  }
  req.authenticatedUser = user
  next()
}

function requireAdmin(req, res, next) {
  if (req.authenticatedUser?.role !== 'admin') {
    return res.status(403).json({ code: 'ADMIN_REQUIRED', message: 'Esta acción requiere permisos de administrador.' })
  }
  next()
}

function parse(schema, input, res) {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  res.status(400).json({
    code: 'VALIDATION_ERROR',
    message: 'Revisa los campos indicados.',
    fields: result.error.flatten().fieldErrors,
  })
  return null
}

const emailSchema = z.string().trim().toLowerCase().email().max(254)
const passwordSchema = z.string().min(12).max(128)
const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) }).strict()
const createUserSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: emailSchema,
  role: z.enum(['admin', 'operator']),
  password: passwordSchema,
}).strict()
const updateUserSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  email: emailSchema,
  role: z.enum(['admin', 'operator']),
  status: z.enum(['active', 'disabled']),
  password: z.union([z.literal(''), passwordSchema]).optional(),
}).strict()
const idSchema = z.string().uuid()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'LOGIN_RATE_LIMIT', message: 'Demasiados intentos. Espera unos minutos antes de volver a probar.' },
})

const dummyPasswordHash = await hashPassword(randomBytes(24).toString('hex'))

app.get('/api/auth/session', (req, res) => {
  const user = sessionUser(req)
  if (req.session.userId && !user) req.session.userId = undefined
  res.set('Cache-Control', 'no-store')
  res.json({
    authenticated: Boolean(user),
    user,
    csrfToken: generateToken(req),
    setupRequired: userQueries.count.get().total === 0,
  })
})

app.post('/api/auth/login', loginLimiter, csrfSynchronisedProtection, async (req, res, next) => {
  try {
    const input = parse(loginSchema, req.body, res)
    if (!input) return

    const user = userQueries.findByEmail.get(input.email)
    const validPassword = await verifyPassword(input.password, user?.passwordHash || dummyPasswordHash)
    if (!user || !validPassword || user.status !== 'active') {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' })
    }

    req.session.regenerate((error) => {
      if (error) return next(error)
      req.session.userId = user.id
      const csrfToken = generateToken(req, true)
      const now = new Date().toISOString()
      userQueries.touchLogin.run(now, now, user.id)
      req.session.save((saveError) => {
        if (saveError) return next(saveError)
        res.set('Cache-Control', 'no-store')
        res.json({ user: userQueries.findPublicById.get(user.id), csrfToken })
      })
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/logout', csrfSynchronisedProtection, (req, res, next) => {
  revokeToken(req)
  req.session.destroy((error) => {
    if (error) return next(error)
    res.clearCookie('kaam.sid', { httpOnly: true, sameSite: 'strict', secure: secureCookie, path: '/' })
    res.status(204).end()
  })
})

app.get('/api/users', requireAuthentication, requireAdmin, (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ users: userQueries.list.all() })
})

app.post('/api/users', requireAuthentication, requireAdmin, csrfSynchronisedProtection, async (req, res, next) => {
  try {
    const input = parse(createUserSchema, req.body, res)
    if (!input) return
    if (userQueries.findByEmail.get(input.email)) {
      return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Ya existe un usuario con ese correo.' })
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    userQueries.insert.run({
      id,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: 'active',
      passwordHash: await hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    })
    res.status(201).json({ user: userQueries.findPublicById.get(id) })
  } catch (error) {
    next(error)
  }
})

app.patch('/api/users/:id', requireAuthentication, requireAdmin, csrfSynchronisedProtection, async (req, res, next) => {
  try {
    const id = idSchema.safeParse(req.params.id)
    if (!id.success) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' })
    const input = parse(updateUserSchema, req.body, res)
    if (!input) return

    const existing = userQueries.findById.get(id.data)
    if (!existing) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' })
    if (existing.email.toLowerCase() !== input.email && userQueries.findByEmail.get(input.email)) {
      return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Ya existe un usuario con ese correo.' })
    }
    if (existing.id === req.authenticatedUser.id && input.status === 'disabled') {
      return res.status(409).json({ code: 'CANNOT_DISABLE_SELF', message: 'No puedes desactivar tu propia cuenta.' })
    }
    const removesActiveAdmin = existing.role === 'admin'
      && existing.status === 'active'
      && (input.role !== 'admin' || input.status !== 'active')
    if (removesActiveAdmin && userQueries.countActiveAdmins.get().total <= 1) {
      return res.status(409).json({ code: 'LAST_ADMIN', message: 'Debe quedar al menos un administrador activo.' })
    }

    userQueries.updateProfile.run({
      id: existing.id,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: input.status,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      updatedAt: new Date().toISOString(),
    })
    if (input.status === 'disabled' || input.password) userQueries.deleteSessionsForUser.run(existing.id)
    res.json({ user: userQueries.findPublicById.get(existing.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/users/:id', requireAuthentication, requireAdmin, csrfSynchronisedProtection, (req, res) => {
  const id = idSchema.safeParse(req.params.id)
  if (!id.success) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' })
  const existing = userQueries.findById.get(id.data)
  if (!existing) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' })
  if (existing.id === req.authenticatedUser.id) {
    return res.status(409).json({ code: 'CANNOT_DELETE_SELF', message: 'No puedes eliminar tu propia cuenta.' })
  }
  if (existing.role === 'admin' && existing.status === 'active' && userQueries.countActiveAdmins.get().total <= 1) {
    return res.status(409).json({ code: 'LAST_ADMIN', message: 'Debe quedar al menos un administrador activo.' })
  }
  if (existing.status !== 'disabled') {
    return res.status(409).json({ code: 'DISABLE_FIRST', message: 'Desactiva la cuenta antes de eliminarla definitivamente.' })
  }

  db.transaction(() => {
    userQueries.deleteSessionsForUser.run(existing.id)
    userQueries.delete.run(existing.id)
  })()
  res.status(204).end()
})

if (isProduction) {
  const distPath = resolve(projectRoot, 'dist')
  app.use(express.static(distPath, { dotfiles: 'deny', index: false, maxAge: '1h' }))
  app.get('*splat', (_req, res) => res.sendFile('index.html', { root: distPath, dotfiles: 'deny' }))
}

app.use('/api', (_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Recurso no encontrado.' }))
app.use((error, _req, res, _next) => {
  if (error?.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ code: 'INVALID_CSRF', message: 'La sesión de seguridad ha cambiado. Recarga e inténtalo de nuevo.' })
  }
  if (error?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Ya existe un usuario con ese correo.' })
  }
  console.error('Error interno de Garaje Kaam:', error?.message || 'desconocido')
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'No se pudo completar la operación.' })
})

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`API de Garaje Kaam disponible en http://127.0.0.1:${port}`)
  if (userQueries.count.get().total === 0) console.log('No hay usuarios. Ejecuta npm run user:init antes de iniciar sesión.')
})

server.requestTimeout = 15_000
server.headersTimeout = 16_000
server.keepAliveTimeout = 5_000
server.on('error', (error) => console.error('Error del servidor HTTP:', error.message))
