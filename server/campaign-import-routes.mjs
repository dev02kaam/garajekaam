import express from 'express'
import multer from 'multer'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, dirname, basename } from 'node:path'
import { z } from 'zod'
import { campaignImportPolicy as limits } from '../shared/campaign-import-policy.mjs'
import { resolveProduct } from './products.mjs'
import { importCampaign } from './campaign-import.mjs'
import { campaignImportConfigured, startImportedCampaign } from './n8n-client.mjs'

let activeImports = 0
const inputSchema = z.object({ prompt: z.string().trim().min(8).max(1200), source: z.literal('garaje-kaam'),
  validContacts: z.coerce.number().int().min(1).max(limits.maxRows), campaign_id: z.string().uuid(), product_id: z.string().optional() }).strict()

export function campaignImportRouter({ pool, productId, schema = 'public', authenticate, protectCsrf,
  configured = campaignImportConfigured, start = startImportedCampaign, ingest = importCampaign }) {
  const router = express.Router()
  router.post('/campaigns/import', authenticate, protectCsrf, async (req, res, next) => {
    let directory
    const controller = new AbortController()
    const abort = () => { if (!res.writableEnded) controller.abort() }
    if (activeImports >= 2) return res.status(429).json({ code: 'IMPORT_BUSY', message: 'Hay dos listas importándose. Espera a que termine una y vuelve a intentarlo.' })
    activeImports++
    req.once('aborted', abort); res.once('close', abort)
    try {
      resolveProduct(productId, 'campaigns')
      if (!configured(productId)) return res.status(503).json({ code: 'IMPORT_NOT_CONFIGURED', message: 'Falta configurar la conexión autenticada con n8n para importar listas grandes.' })
      directory = await mkdtemp(join(tmpdir(), 'kaam-csv-'))
      const upload = multer({ dest: directory, limits: { files: 1, fileSize: limits.maxBytes, fields: 5, fieldSize: 8192, parts: 7 },
        fileFilter: (_req, file, callback) => {
          const valid = file.originalname.toLowerCase().endsWith('.csv') && ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain', 'application/octet-stream'].includes(file.mimetype)
          callback(valid ? null : new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'csv'), valid)
        } }).single('csv')
      await new Promise((resolve, reject) => upload(req, res, error => error ? reject(error) : resolve()))
      const parsed = inputSchema.safeParse(req.body)
      if (!parsed.success) return res.status(400).json({ code: 'INVALID_INPUT', message: 'Revisa el archivo y la instrucción (mínimo 8 caracteres).' })
      resolveProduct(productId, 'campaigns', parsed.data.product_id)
      if (!req.file) return res.status(400).json({ code: 'CSV_REQUIRED', message: 'Adjunta un archivo CSV.' })
      const result = await ingest({ pool, file: req.file, ...parsed.data, productId, schema, signal: controller.signal })
      const { recovery_token, ...publicResult } = result
      let started = false
      if (recovery_token) {
        try { await start({ productId, campaign_id: result.campaign_id, recovery_token }); started = true }
        catch { /* Already committed: keep the campaign, its ticket and recovery lease. */ }
      }
      res.status(202).json({ ...publicResult, startup_pending: !started && !result.deduplicated,
        message: result.deduplicated ? 'Esta campaña ya estaba registrada. Puedes consultar su estado en Actividad.'
          : started ? `Campaña registrada con ${result.accepted_contacts.toLocaleString('es-ES')} contactos únicos.`
            : 'La campaña está guardada. El inicio en n8n está pendiente de confirmación; consulta Actividad sin volver a crearla.' })
    } catch (error) {
      if (controller.signal.aborted) return
      if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ code: 'INVALID_CSV_UPLOAD', message: error.code === 'LIMIT_FILE_SIZE' ? 'El CSV supera el máximo de 100 MB.' : 'Adjunta un único CSV con sus campos de campaña.' })
      if (error.status && error.code) return res.status(error.status).json({ code: error.code, message: error.message, product_id: productId })
      next(error)
    } finally {
      req.removeListener('aborted', abort); res.removeListener('close', abort)
      if (directory && dirname(resolve(directory)) === resolve(tmpdir()) && basename(directory).startsWith('kaam-csv-')) {
        await rm(directory, { recursive: true, force: true }).catch(() => {})
      }
      activeImports--
    }
  })
  return router
}
