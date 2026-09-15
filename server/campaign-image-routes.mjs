import express from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { CampaignImageError, MAX_IMAGE_BYTES } from './campaign-images.mjs'
import { isUtf8 } from 'node:buffer'

function uploadedFile(file) {
  if (!file) return file
  // Browsers send multipart filenames as UTF-8; Multer's parameter default is latin1.
  const nameBytes = Buffer.from(file.originalname, 'latin1')
  return { ...file, originalname: isUtf8(nameBytes) ? nameBytes.toString('utf8') : file.originalname }
}

export function campaignImageRouter({ store, authenticate, protectCsrf }) {
  const router = express.Router()
  const id = z.string().regex(/^ficharia-campana-[0-9]{2}$/)
  const revision = z.string().regex(/^\d{1,20}$/)
  const upload = multer({ storage: multer.memoryStorage(), limits: { files: 1, fileSize: MAX_IMAGE_BYTES, fields: 1, fieldSize: 64, parts: 3 } })
  const limitWrites = rateLimit({ windowMs: 60_000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { code: 'IMAGE_RATE_LIMIT', message: 'Has hecho muchos cambios seguidos. Espera un minuto antes de continuar.' } })
  router.use(authenticate)
  router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next() })
  router.param('id', (req, res, next, value) => {
    if (!id.safeParse(value).success) return res.status(400).json({ code: 'INVALID_IMAGE_ID', message: 'La imagen indicada no es válida.' })
    next()
  })
  const validate = (schema, input) => {
    const result = schema.safeParse(input)
    if (!result.success) throw new CampaignImageError(400, 'INVALID_IMAGE_REQUEST', 'Revisa los datos de la solicitud y actualiza la biblioteca.')
    return result.data
  }
  router.get('/', async (_req, res) => { res.json(await store.list()) })
  router.get('/:id/file', async (req, res) => {
    const query = validate(z.object({ thumbnail: z.enum(['1']).optional(), download: z.enum(['1']).optional(), v: z.string().max(64).optional() }).strict(), req.query)
    const image = await store.content(req.params.id, query.thumbnail === '1' && query.download !== '1')
    res.type(image.mimeType)
    res.set('X-Content-Type-Options', 'nosniff')
    if (query.download === '1') res.attachment(image.fileName)
    res.send(image.bytes)
  })
  router.post('/', protectCsrf, limitWrites, upload.single('image'), async (req, res) => {
    validate(z.object({}).strict(), req.body)
    const result = await store.upload(uploadedFile(req.file))
    res.status(result.duplicate ? 200 : 201).json(result)
  })
  router.patch('/:id', protectCsrf, limitWrites, async (req, res) => {
    const input = validate(z.object({ active: z.boolean(), revision }).strict(), req.body)
    res.json(await store.setActive(req.params.id, input.active, input.revision))
  })
  router.put('/:id', protectCsrf, limitWrites, upload.single('image'), async (req, res) => {
    const input = validate(z.object({ revision }).strict(), req.body)
    res.json(await store.replace(req.params.id, uploadedFile(req.file), input.revision))
  })
  router.use((error, _req, res, next) => {
    if (error instanceof CampaignImageError) return res.status(error.status).json({ code: error.code, message: error.message })
    if (error instanceof multer.MulterError) {
      return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ code: 'INVALID_IMAGE_UPLOAD',
        message: error.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el máximo de 10 MB.' : 'Sube una imagen por solicitud, en el campo image.' })
    }
    next(error)
  })
  return router
}
