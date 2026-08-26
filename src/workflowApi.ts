import { ApiError } from './auth'

export type WorkflowCampaign = {
  id: string
  externalId: string | null
  title: string
  filename: string
  createdAt: string
  completedAt: string | null
  csvRows: number | null
  csvValid: number | null
  prompt: string
  status: 'completed' | 'running' | 'failed' | 'pending-data'
  workflowStatus: string
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
  emails: Array<{
    id: string
    messageId: string
    subject: string
    receivedAt: string | null
    status: 'completed' | 'failed' | 'active'
    classification: string | null
    confidence: number | null
    summary: string
  }>
}

export type WorkflowFollowupConversation = {
  id: string
  contact: string
  company: string
  email: string
  state: 'waiting' | 'replied' | 'closed'
  nextFollowUpAt: string | null
  followUpCount: number
  events: Array<{
    id: string
    followUpNumber: number
    status: string
    dueAt: string | null
    sentAt: string | null
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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', ...init.headers },
    })
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'No se puede consultar PostgreSQL.' })
  }

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload as T
}

export const workflowApi = {
  config: () => request<{ campaignWebhookConfigured: boolean }>('/api/workflows/config'),
  jobs: (limit = 100) => request<{ available: boolean; jobs: WorkflowJob[] }>(`/api/workflows/jobs?limit=${limit}`),
  campaigns: (limit = 100) => request<{ available: boolean; campaigns: WorkflowCampaign[] }>(`/api/workflows/campaigns?limit=${limit}`),
  conversations: (limit = 100) => request<{ available: boolean; conversations: WorkflowConversation[] }>(`/api/workflows/conversations?limit=${limit}`),
  followups: (limit = 100) => request<{ available: boolean; conversations: WorkflowFollowupConversation[] }>(`/api/workflows/followups?limit=${limit}`),
  creatives: (limit = 100) => request<{ available: boolean; assets: WorkflowCreative[] }>(`/api/workflows/creatives?limit=${limit}`),
  launchCampaign: (form: FormData, csrfToken: string) => request<Record<string, unknown>>('/api/workflows/campaigns/launch', {
    method: 'POST',
    headers: { 'X-CSRF-Token': csrfToken },
    body: form,
  }),
}
