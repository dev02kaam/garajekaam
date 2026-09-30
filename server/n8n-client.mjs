import { basename } from 'node:path'
import { resolveProduct } from './products.mjs'
import { CAMPAIGN_WEBHOOK_TIMEOUT_MS } from '../shared/campaign-timeouts.mjs'

const isProduction = process.env.NODE_ENV === 'production'
const webhookPath = process.env.N8N_PROSPECTING_WEBHOOK_PATH?.trim() || '/webhook/ficharia/campanas'
if (!webhookPath.startsWith('/') || webhookPath.startsWith('//')) {
  throw new Error('N8N_PROSPECTING_WEBHOOK_PATH debe ser una ruta absoluta del servidor n8n.')
}
const rawCampaignWebhook = process.env.N8N_PROSPECTING_WEBHOOK_URL?.trim()
  || (process.env.N8N_BASE_URL?.trim() ? new URL(webhookPath, process.env.N8N_BASE_URL.trim()).href : '')

function configuredWebhook(rawValue) {
  if (!rawValue) return null
  const url = new URL(rawValue)
  const localDevelopment = !isProduction
    && url.protocol === 'http:'
    && ['127.0.0.1', 'localhost'].includes(url.hostname)
  if (url.protocol !== 'https:' && !localDevelopment) {
    throw new Error('N8N_PROSPECTING_WEBHOOK_URL debe usar HTTPS (salvo localhost en desarrollo).')
  }
  if (url.username || url.password || url.hash) {
    throw new Error('N8N_PROSPECTING_WEBHOOK_URL no puede incluir credenciales ni fragmentos.')
  }
  return url
}

const campaignWebhook = configuredWebhook(rawCampaignWebhook)
const dekaamWebhook = configuredWebhook(process.env.N8N_DEKAAM_WEBHOOK_URL?.trim()
 || (campaignWebhook ? new URL('/webhook/dekaam/campanas', campaignWebhook).href : ''))
const productWebhook = id => id === 'deca' ? dekaamWebhook : campaignWebhook

function safeFilename(value) {
  return basename(value || 'contactos.csv')
    .replace(/[^a-z0-9._ -]/gi, '_')
    .slice(0, 120) || 'contactos.csv'
}

async function responsePayload(response) {
  const declaredSize = Number(response.headers.get('content-length') || 0)
  if (declaredSize > 64 * 1024) throw new Error('n8n devolvió una respuesta demasiado grande.')
  const text = await response.text()
  if (Buffer.byteLength(text, 'utf8') > 64 * 1024) throw new Error('n8n devolvió una respuesta demasiado grande.')
  if (!text.trim()) return {}
  if (response.headers.get('content-type')?.includes('application/json')) {
    try { return JSON.parse(text) } catch { return { message: text } }
  }
  return { message: text }
}

export function campaignWebhookConfigured(productId = 'ficharia') {
  return Boolean(productWebhook(productId))
}

export function campaignImportConfigured(productId = 'ficharia') {
  return campaignWebhookConfigured(productId) && Boolean(process.env.N8N_WEBHOOK_AUTH_TOKEN?.trim())
}

export async function startImportedCampaign({ productId, campaign_id, recovery_token }) {
  resolveProduct(productId, 'campaigns')
  if (!campaignImportConfigured(productId)) throw Object.assign(new Error('Falta configurar el webhook autenticado.'), { code: 'IMPORT_NOT_CONFIGURED' })
  const url = new URL(productId === 'deca' ? '/webhook/dekaam/campanas/recuperar' : '/webhook/ficharia/campanas/recuperar', productWebhook(productId))
  const response = await fetch(url, { method: 'POST', redirect: 'error',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.N8N_WEBHOOK_AUTH_TOKEN.trim()}` },
    body: JSON.stringify({ campaign_id, recovery_token }), signal: AbortSignal.timeout(25_000) })
  const result = await responsePayload(response)
  if (!response.ok || result.accepted !== true || result.campaign_id !== campaign_id) {
    throw Object.assign(new Error('La campaña está guardada, pero n8n no ha confirmado su inicio.'), { code: 'IMPORT_START_PENDING' })
  }
  return result
}

export async function launchCampaign({ file, prompt, source, validContacts, campaign_id, productId = 'ficharia' }) {
  resolveProduct(productId, 'campaigns')
  const selectedWebhook = productWebhook(productId)
  if (!selectedWebhook) {
    const error = new Error('El webhook de campañas de n8n todavía no está configurado.')
    error.code = 'N8N_NOT_CONFIGURED'
    throw error
  }

  const form = new FormData()
  form.append('csv', new Blob([file.buffer], { type: 'text/csv' }), safeFilename(file.originalname))
  form.append('prompt', prompt)
  form.append('source', source)
  form.append('product_id', productId)
  form.append('validContacts', String(validContacts))
  if (campaign_id) form.append('campaign_id', campaign_id)

  const headers = { Accept: 'application/json' }
  if (process.env.N8N_WEBHOOK_AUTH_TOKEN?.trim()) {
    headers.Authorization = `Bearer ${process.env.N8N_WEBHOOK_AUTH_TOKEN.trim()}`
  }

  const response = await fetch(selectedWebhook, {
    method: 'POST',
    headers,
    body: form,
    redirect: 'manual',
    signal: AbortSignal.timeout(CAMPAIGN_WEBHOOK_TIMEOUT_MS),
  })
  const payload = await responsePayload(response)
  if (!response.ok) {
    const error = new Error(typeof payload.message === 'string' ? payload.message : 'n8n rechazó la campaña.')
    error.code = 'N8N_REJECTED'
    error.status = response.status
    throw error
  }
  if (payload.product_id !== undefined && payload.product_id !== productId) {
    const error = new Error('El servicio devolvió una respuesta de otro producto.')
    error.code = 'PRODUCT_ID_MISMATCH'; error.status = 502; throw error
  }
  return payload
}
