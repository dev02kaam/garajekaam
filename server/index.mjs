import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import session from 'express-session'
import pgSessionFactory from 'connect-pg-simple'
import multer from 'multer'
import { csrfSync } from 'csrf-sync'
import { z } from 'zod'
import {
  authSchema,
  closeDatabase,
  initializeDatabase,
  pool,
  sessionTableName,
  userQueries,
} from './database.mjs'
import { hashPassword, verifyPassword } from './security.mjs'
import {
  getCampaigns,
  getCampaignContacts,
  getConversationEmail,
  getConversations,
  getCreatives,
  getFollowups,
  getJobs,
} from './workflow-data.mjs'
import { campaignWebhookConfigured, launchCampaign } from './n8n-client.mjs'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const isProduction = process.env.NODE_ENV === 'production'
const port = Number(process.env.PORT || 4174)
const host = process.env.RENDER ? '0.0.0.0' : '127.0.0.1'
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

await initializeDatabase()

const PostgresSessionStore = pgSessionFactory(session)
app.use(session({
  name: 'kaam.sid',
  secret: loadSessionSecret(),
  store: new PostgresSessionStore({
    pool,
    schemaName: authSchema,
    tableName: sessionTableName,
    createTableIfMissing: false,
    pruneSessionInterval: 15 * 60,
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

async function sessionUser(req) {
  if (!req.session.userId) return null
  const user = await userQueries.findPublicById(req.session.userId)
  if (!user || user.status !== 'active') return null
  return user
}

async function requireAuthentication(req, res, next) {
  const user = await sessionUser(req)
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
const dashboardQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
}).strict()
const campaignContactsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(2_000_000).default(0),
  query: z.string().trim().max(160).default(''),
  status: z.enum(['all', 'sent', 'pending', 'issues', 'not-selected']).default('all'),
}).strict()
const campaignLaunchSchema = z.object({
  prompt: z.string().trim().min(1).max(1200),
  source: z.literal('garaje-kaam'),
  validContacts: z.coerce.number().int().min(1).max(2_000_000),
}).strict()

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 10 * 1024 * 1024, fields: 4, fieldSize: 8 * 1024 },
  fileFilter: (_req, file, callback) => {
    const csvName = file.originalname.toLowerCase().endsWith('.csv')
    const csvType = ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'].includes(file.mimetype)
    callback(csvName && csvType ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'csv'), csvName && csvType)
  },
})

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { code: 'LOGIN_RATE_LIMIT', message: 'Demasiados intentos. Espera unos minutos antes de volver a probar.' },
})

const dummyPasswordHash = await hashPassword(randomBytes(24).toString('hex'))

async function bootstrapInitialAdmin() {
  if (await userQueries.count() > 0) return

  const email = process.env.KAAM_INITIAL_ADMIN_EMAIL?.trim().toLowerCase()
  const displayName = process.env.KAAM_INITIAL_ADMIN_NAME?.trim()
  const password = process.env.KAAM_INITIAL_ADMIN_PASSWORD
  if (!email && !displayName && !password) return

  const input = createUserSchema.safeParse({ email, displayName, password, role: 'admin' })
  if (!input.success) {
    throw new Error('Las variables KAAM_INITIAL_ADMIN_* no forman un administrador inicial válido.')
  }

  const createdAt = new Date().toISOString()
  const created = await userQueries.insertInitialAdmin({
    id: randomUUID(),
    email: input.data.email,
    displayName: input.data.displayName,
    passwordHash: await hashPassword(input.data.password),
    createdAt,
  })
  if (created) console.log(`Administrador inicial creado: ${input.data.email}`)
}

await bootstrapInitialAdmin()

app.get('/api/auth/session', async (req, res) => {
  const user = await sessionUser(req)
  if (req.session.userId && !user) req.session.userId = undefined
  res.set('Cache-Control', 'no-store')
  res.json({
    authenticated: Boolean(user),
    user,
    csrfToken: generateToken(req),
    setupRequired: await userQueries.count() === 0,
  })
})

app.post('/api/auth/login', loginLimiter, csrfSynchronisedProtection, async (req, res, next) => {
  try {
    const input = parse(loginSchema, req.body, res)
    if (!input) return

    const user = await userQueries.findByEmail(input.email)
    const validPassword = await verifyPassword(input.password, user?.passwordHash || dummyPasswordHash)
    if (!user || !validPassword || user.status !== 'active') {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Correo o contraseña incorrectos.' })
    }

    req.session.regenerate(async (error) => {
      if (error) return next(error)
      try {
        req.session.userId = user.id
        const csrfToken = generateToken(req, true)
        const now = new Date().toISOString()
        await userQueries.touchLogin(now, user.id)
        const publicUser = await userQueries.findPublicById(user.id)
        req.session.save((saveError) => {
          if (saveError) return next(saveError)
          res.set('Cache-Control', 'no-store')
          res.json({ user: publicUser, csrfToken })
        })
      } catch (callbackError) {
        next(callbackError)
      }
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

app.get('/api/users', requireAuthentication, requireAdmin, async (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ users: await userQueries.list() })
})

app.post('/api/users', requireAuthentication, requireAdmin, csrfSynchronisedProtection, async (req, res, next) => {
  try {
    const input = parse(createUserSchema, req.body, res)
    if (!input) return
    if (await userQueries.findByEmail(input.email)) {
      return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Ya existe un usuario con ese correo.' })
    }

    const now = new Date().toISOString()
    const id = randomUUID()
    await userQueries.insert({
      id,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: 'active',
      passwordHash: await hashPassword(input.password),
      createdAt: now,
      updatedAt: now,
    })
    res.status(201).json({ user: await userQueries.findPublicById(id) })
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

    const existing = await userQueries.findById(id.data)
    if (!existing) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' })
    if (existing.email.toLowerCase() !== input.email && await userQueries.findByEmail(input.email)) {
      return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Ya existe un usuario con ese correo.' })
    }
    if (existing.id === req.authenticatedUser.id && input.status === 'disabled') {
      return res.status(409).json({ code: 'CANNOT_DISABLE_SELF', message: 'No puedes desactivar tu propia cuenta.' })
    }
    const removesActiveAdmin = existing.role === 'admin'
      && existing.status === 'active'
      && (input.role !== 'admin' || input.status !== 'active')
    if (removesActiveAdmin && await userQueries.countActiveAdmins() <= 1) {
      return res.status(409).json({ code: 'LAST_ADMIN', message: 'Debe quedar al menos un administrador activo.' })
    }

    await userQueries.updateProfile({
      id: existing.id,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      status: input.status,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      updatedAt: new Date().toISOString(),
    })
    if (input.status === 'disabled' || input.password) await userQueries.deleteSessionsForUser(existing.id)
    res.json({ user: await userQueries.findPublicById(existing.id) })
  } catch (error) {
    next(error)
  }
})

app.delete('/api/users/:id', requireAuthentication, requireAdmin, csrfSynchronisedProtection, async (req, res) => {
  const id = idSchema.safeParse(req.params.id)
  if (!id.success) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' })
  const existing = await userQueries.findById(id.data)
  if (!existing) return res.status(404).json({ code: 'USER_NOT_FOUND', message: 'Usuario no encontrado.' })
  if (existing.id === req.authenticatedUser.id) {
    return res.status(409).json({ code: 'CANNOT_DELETE_SELF', message: 'No puedes eliminar tu propia cuenta.' })
  }
  if (existing.role === 'admin' && existing.status === 'active' && await userQueries.countActiveAdmins() <= 1) {
    return res.status(409).json({ code: 'LAST_ADMIN', message: 'Debe quedar al menos un administrador activo.' })
  }
  if (existing.status !== 'disabled') {
    return res.status(409).json({ code: 'DISABLE_FIRST', message: 'Desactiva la cuenta antes de eliminarla definitivamente.' })
  }

  await userQueries.deleteSessionsForUser(existing.id)
  await userQueries.delete(existing.id)
  res.status(204).end()
})

function dashboardRoute(loader) {
  return async (req, res) => {
    const input = parse(dashboardQuerySchema, req.query, res)
    if (!input) return
    res.set('Cache-Control', 'private, no-store')
    res.json(await loader(input.limit))
  }
}

app.get('/api/workflows/jobs', requireAuthentication, dashboardRoute(getJobs))
app.get('/api/workflows/campaigns', requireAuthentication, dashboardRoute(getCampaigns))
app.get('/api/workflows/campaigns/:campaignId/contacts', requireAuthentication, async (req, res) => {
  const campaignId = parse(idSchema, req.params.campaignId, res)
  if (!campaignId) return
  const input = parse(campaignContactsQuerySchema, req.query, res)
  if (!input) return
  res.set('Cache-Control', 'private, no-store')
  res.json(await getCampaignContacts({ campaignId, ...input }))
})
app.get('/api/workflows/conversations', requireAuthentication, dashboardRoute(getConversations))
app.get('/api/workflows/conversations/emails/:emailId', requireAuthentication, async (req, res) => {
  const emailId = parse(idSchema, req.params.emailId, res)
  if (!emailId) return
  res.set('Cache-Control', 'private, no-store')
  const result = await getConversationEmail(emailId)
  if (result.available && !result.email) {
    return res.status(404).json({ code: 'EMAIL_NOT_FOUND', message: 'No se encontró el correo solicitado.' })
  }
  res.json(result)
})
app.get('/api/workflows/followups', requireAuthentication, dashboardRoute(getFollowups))
app.get('/api/workflows/creatives', requireAuthentication, dashboardRoute(getCreatives))
app.get('/api/workflows/config', requireAuthentication, (_req, res) => {
  res.set('Cache-Control', 'private, no-store')
  res.json({ campaignWebhookConfigured: campaignWebhookConfigured() })
})
app.post(
  '/api/workflows/campaigns/launch',
  requireAuthentication,
  csrfSynchronisedProtection,
  csvUpload.single('csv'),
  async (req, res, next) => {
    try {
      const input = parse(campaignLaunchSchema, req.body, res)
      if (!input) return
      if (!req.file) return res.status(400).json({ code: 'CSV_REQUIRED', message: 'Adjunta un archivo CSV.' })
      const sample = req.file.buffer.subarray(0, Math.min(req.file.size, 64 * 1024)).toString('utf8')
      if (sample.includes('\0') || !/\r?\n/.test(sample)) {
        return res.status(400).json({ code: 'INVALID_CSV', message: 'El archivo no parece un CSV válido.' })
      }
      res.status(202).json(await launchCampaign({ file: req.file, ...input }))
    } catch (error) {
      if (error?.code === 'N8N_NOT_CONFIGURED') {
        return res.status(503).json({ code: error.code, message: error.message })
      }
      if (error?.code === 'N8N_REJECTED' || error?.name === 'TimeoutError') {
        return res.status(502).json({ code: error.code || 'N8N_TIMEOUT', message: error.message || 'n8n no respondió a tiempo.' })
      }
      if (error instanceof TypeError) {
        return res.status(502).json({ code: 'N8N_UNREACHABLE', message: 'No se pudo conectar con n8n.' })
      }
      next(error)
    }
  },
)

if (isProduction) {
  const distPath = resolve(projectRoot, 'dist')
  app.use(express.static(distPath, { dotfiles: 'deny', index: false, maxAge: '1h' }))
  app.get('*splat', (_req, res) => res.sendFile('index.html', { root: distPath, dotfiles: 'deny' }))
}

app.use('/api', (_req, res) => res.status(404).json({ code: 'NOT_FOUND', message: 'Recurso no encontrado.' }))
app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) {
    const message = error.code === 'LIMIT_FILE_SIZE'
      ? 'El CSV supera el máximo de 10 MB.'
      : 'Solo se admite un archivo CSV.'
    return res.status(400).json({ code: 'INVALID_CSV_UPLOAD', message })
  }
  if (error?.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ code: 'INVALID_CSRF', message: 'La sesión de seguridad ha cambiado. Recarga e inténtalo de nuevo.' })
  }
  if (error?.code === '23505') {
    return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Ya existe un usuario con ese correo.' })
  }
  console.error('Error interno de Garaje Kaam:', error?.message || 'desconocido')
  res.status(500).json({ code: 'INTERNAL_ERROR', message: 'No se pudo completar la operación.' })
})

const server = app.listen(port, host, async () => {
  console.log(`API de Garaje Kaam escuchando en http://${host}:${port}`)
  if (await userQueries.count() === 0) console.log('No hay usuarios. Configura KAAM_INITIAL_ADMIN_* o ejecuta npm run user:init.')
})

server.requestTimeout = 15_000
server.headersTimeout = 16_000
server.keepAliveTimeout = 5_000
server.on('error', (error) => console.error('Error del servidor HTTP:', error.message))

async function shutdown(signal) {
  console.log(`Cerrando Garaje Kaam (${signal})...`)
  server.close(async () => {
    await closeDatabase()
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('SIGTERM', () => void shutdown('SIGTERM'))
