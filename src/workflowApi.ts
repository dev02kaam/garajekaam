import { request as rawRequest, type ApiRequestInit } from './auth'
import { CAMPAIGN_REQUEST_TIMEOUT_MS } from '../shared/campaign-timeouts.mjs'

export type WorkflowCampaign = {
  id: string
  externalId: string | null
  title: string
  filename: string
  createdAt: string
  updatedAt: string | null
  completedAt: string | null
  csvRows: number | null
  csvValid: number | null
  prompt: string
  status: 'completed' | 'partial' | 'running' | 'needs-review' | 'cancelled' | 'queued' | 'paused' | 'failed' | 'pending-data'
  workflowStatus: string
  lastError: { code: string | null; message: string | null } | null
  deliveryHealth?: { needsRecovery: boolean; expiredReservations: number; lastSentAt: string | null; transportDelayed?: boolean; stalledTransports?: number; oldestTransportAt?: string | null }
  execution: {
    pendingSegmentation: number
    segmenting: number
    notSelected: number
    scheduled: number
    sending: number
    sent: number
    suppressed: number
    capacityExhausted: number
    deliveryUnknown: number
    failed: number
  }
  selectedCompanies: number | null
  companiesContacted: number | null
  replies: number | null
  interested: number | null
  nextScheduledAt: string | null
  days: Array<{ date: string; segment: string; window: string; contacted: number }>
  deliveryIssues: Array<{
    id: string
    company: string
    email: string
    segment: string
    reason: string
    attemptedAt: string | null
  }>
}

export type WorkflowCampaignContact = {
  id: string
  company: string
  name: string | null
  email: string
  segment: string | null
  status: string
  recoveryPending?: boolean
  matchScore: number | null
  matchReason: string | null
  scheduledAt: string | null
  nextAttemptAt: string | null
  attemptedAt: string | null
  sentAt: string | null
  sendAttemptCount: number
  providerMessageId: string | null
  error: { code: string | null; message: string | null } | null
  emailContent: {
    subject: string
    opening: string
    cta: string
  } | null
  reply: {
    id: string
    subject: string
    receivedAt: string | null
    classification: string | null
    confidence: number | null
  } | null
}

export type WorkflowConversationEmail = {
  id: string
  messageId: string
  subject: string
  receivedAt: string | null
  status: 'completed' | 'failed' | 'active'
  classification: string | null
  confidence: number | null
  summary: string
  incoming: {
    fromEmail: string
    toEmail: string
    body: string
  }
  reply: {
    id: string
    messageId: string
    subject: string
    sentAt: string | null
    status: string
    fromEmail: string
    toEmail: string
    body: string
  } | null
}

export type WorkflowConversation = {
  id: string
  contact: string
  company: string
  email: string
  status: string
  intent: string | null
  summary: string | null
  lastActivity: string | null
  incomingCount: number
  outgoingCount: number
  emails: Array<Omit<WorkflowConversationEmail, 'incoming' | 'reply'>>
}

export type WorkflowFollowupConversation = {
  id: string
  contact: string
  company: string
  email: string
  state: 'waiting' | 'generating' | 'sending' | 'replied' | 'closed' | 'failed' | 'needs-review'
  lastBardoMessageAt: string | null
  responseDetectedAt: string | null
  eligibleAt: string | null
  nextFollowUpAt: string | null
  followUpCount: number
  events: Array<{
    id: string
    followUpNumber: number
    status: string
    dueAt: string | null
    sentAt: string | null
    updatedAt: string | null
    responseDetectedAt: string | null
    cancellationReason: string | null
    error: { code?: string; message?: string } | null
  }>
}

export type WorkflowCreative = {
  id: string
  externalId: string | null
  title: string
  prompt: string
  status: string
  image: string | null
  imageMimeType: string | null
  width: number | null
  height: number | null
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type WorkflowJob = {
  id: string
  type: 'campaign' | 'creative' | string
  externalId: string | null
  status: string
  processing: boolean
  progressPercent: number
  attemptCount: number
  nextAttemptAt: string | null
  leaseExpiresAt: string | null
  error: { code?: string; message?: string } | null
  result: Record<string, unknown> | null
  createdAt: string | null
  updatedAt: string | null
  completedAt: string | null
}

export type CampaignImage = {
  id: string
  fileName: string
  mimeType: string
  sha256: string
  sortOrder: number
  active: boolean
  sizeBytes: number
  createdAt: string
  updatedAt: string
  revision: string
}

export function createWorkflowApi(productId: string, scopeSignal: AbortSignal, beginMutation: () => () => void) {
  const base = '/api/products/' + encodeURIComponent(productId) + '/workflows'
  async function request<T>(path: string, init: ApiRequestInit = {}): Promise<T> {
    scopeSignal.throwIfAborted()
    const release = init.method && init.method !== 'GET' ? beginMutation() : () => {}
    try {
      const signal = init.signal ? AbortSignal.any([scopeSignal, init.signal]) : scopeSignal
      const result = await rawRequest<T>(path, { ...init, signal })
      signal.throwIfAborted()
      return result
    } finally { release() }
  }
  return {
  campaignImageUrl: (image: CampaignImage, mode: 'thumbnail' | 'download' | 'preview' = 'thumbnail') =>
    base + '/campaign-images/' + encodeURIComponent(image.id) + '/file?v=' + image.sha256 + (mode === 'preview' ? '' : '&' + mode + '=1'),
  campaignImages: (signal?: AbortSignal) => request<{ available: boolean; images: CampaignImage[] }>(base + '/campaign-images', { signal }),
  uploadCampaignImage: (file: File, csrfToken: string, signal?: AbortSignal) => {
    const form = new FormData()
    form.append('image', file)
    return request<{ image: CampaignImage; duplicate: boolean }>(base + '/campaign-images', {
      method: 'POST', headers: { 'X-CSRF-Token': csrfToken }, body: form, signal,
    })
  },
  setCampaignImageActive: (image: CampaignImage, active: boolean, csrfToken: string) => request<{ image: CampaignImage }>(`${base}/campaign-images/${encodeURIComponent(image.id)}`, {
    method: 'PATCH', headers: { 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ active, revision: image.revision }),
  }),
  replaceCampaignImage: (image: CampaignImage, file: File, csrfToken: string) => {
    const form = new FormData()
    form.append('image', file)
    form.append('revision', image.revision)
    return request<{ image: CampaignImage }>(`${base}/campaign-images/${encodeURIComponent(image.id)}`, {
      method: 'PUT', headers: { 'X-CSRF-Token': csrfToken }, body: form,
    })
  },
  config: () => request<{ campaignWebhookConfigured: boolean }>(base + '/config'),
  jobs: (limit = 100) => request<{ available: boolean; jobs: WorkflowJob[] }>(`${base}/jobs?limit=${limit}`),
  campaigns: (limit = 100) => request<{ available: boolean; campaigns: WorkflowCampaign[] }>(`${base}/campaigns?limit=${limit}`),
  campaignContacts: (
    campaignId: string,
    options: { limit?: number; offset?: number; query?: string; status?: 'all' | 'sent' | 'pending' | 'issues' | 'not-selected' } = {},
  ) => {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 50),
      offset: String(options.offset ?? 0),
      query: options.query ?? '',
      status: options.status ?? 'all',
    })
    return request<{ available: boolean; total: number; contacts: WorkflowCampaignContact[] }>(
      `${base}/campaigns/${encodeURIComponent(campaignId)}/contacts?${params}`,
    )
  },
  conversations: (limit = 100) => request<{ available: boolean; conversations: WorkflowConversation[] }>(`${base}/conversations?limit=${limit}`),
  conversationEmail: (emailId: string) => request<{ available: boolean; email: WorkflowConversationEmail | null }>(`${base}/conversations/emails/${encodeURIComponent(emailId)}`),
  followups: (limit = 100, signal?: AbortSignal) => request<{ available: boolean; conversations: WorkflowFollowupConversation[] }>(`${base}/followups?limit=${limit}`, { signal }),
  creatives: (limit = 100) => request<{ available: boolean; assets: WorkflowCreative[] }>(`${base}/creatives?limit=${limit}`),
  launchCampaign: (form: FormData, csrfToken: string) => request<Record<string, unknown>>(base + '/campaigns/launch', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: form,
    timeoutMs: CAMPAIGN_REQUEST_TIMEOUT_MS,
  }),
}

}
