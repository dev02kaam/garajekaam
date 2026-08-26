import { pool, workflowSchema, workflowSchemaSql } from './database.mjs'

const relationCache = new Map()
const relationCacheMs = 30_000

async function relationExists(relation) {
  const cached = relationCache.get(relation)
  if (cached && Date.now() - cached.checkedAt < relationCacheMs) return cached.exists

  const result = await pool.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`${workflowSchema}.${relation}`])
  const exists = result.rows[0].exists
  relationCache.set(relation, { exists, checkedAt: Date.now() })
  return exists
}

async function availableQuery(relation, text, values = []) {
  if (!await relationExists(relation)) return { available: false, rows: [] }
  const result = await pool.query({ text, values })
  return { available: true, rows: result.rows }
}

function asNumber(value) {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function iso(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function campaignStatus(status) {
  if (status === 'completed') return 'completed'
  if (['completed_with_errors', 'needs_review', 'cancelled'].includes(status)) return 'failed'
  if (['paused'].includes(status)) return 'pending-data'
  return 'running'
}

function issueReason(row) {
  const error = row.last_error && typeof row.last_error === 'object' ? row.last_error : {}
  return String(error.message || error.code || row.status || 'Incidencia de entrega')
}

function planDays(plan, counts) {
  const segments = Array.isArray(plan?.segments) ? plan.segments : []
  return segments.flatMap((segment) => {
    const dates = Array.isArray(segment.send_dates) ? segment.send_dates : []
    return dates.map((date) => ({
      date: String(date),
      segment: String(segment.label || segment.segment_id || 'Segmento'),
      window: `${segment.window_start || '--:--'}–${segment.window_end || '--:--'}`,
      contacted: counts.get(`${segment.segment_id}:${date}`) || 0,
    }))
  })
}

export async function getCampaigns(limit) {
  const result = await availableQuery('ficharia_outbound_campaign_status', `
    SELECT
      c.campaign_id,
      c.external_id,
      c.source_filename,
      c.prompt,
      c.plan,
      c.config,
      c.status,
      c.accepted_contacts,
      s.pending_segmentation,
      s.segmenting,
      s.not_selected,
      s.scheduled,
      s.sending,
      s.sent,
      s.suppressed,
      s.capacity_exhausted,
      s.delivery_unknown,
      s.failed,
      s.next_scheduled_at,
      c.created_at,
      c.updated_at,
      c.completed_at,
      COALESCE(issues.items, '[]'::jsonb) AS delivery_issues
    FROM ${workflowSchemaSql}.outbound_campaigns c
    JOIN ${workflowSchemaSql}.ficharia_outbound_campaign_status s
      ON s.campaign_id = c.campaign_id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id', x.contact_id,
        'company', COALESCE(NULLIF(x.contact_data->>'company', ''), NULLIF(x.contact_data->>'empresa', ''), 'Empresa sin nombre'),
        'email', x.email_normalized,
        'segment', COALESCE(x.segment_id, 'Sin segmento'),
        'status', x.status,
        'lastError', x.last_error,
        'attemptedAt', COALESCE(x.last_send_attempt_at, x.updated_at)
      ) ORDER BY COALESCE(x.last_send_attempt_at, x.updated_at) DESC) AS items
      FROM (
        SELECT contact_id, contact_data, email_normalized, segment_id, status,
          last_error, last_send_attempt_at, updated_at
        FROM ${workflowSchemaSql}.outbound_campaign_contacts
        WHERE campaign_id = c.campaign_id
          AND status IN ('suppressed', 'capacity_exhausted', 'delivery_unknown', 'failed')
        ORDER BY COALESCE(last_send_attempt_at, updated_at) DESC
        LIMIT 100
      ) x
    ) issues ON true
    ORDER BY c.created_at DESC
    LIMIT $1
  `, [limit])

  if (!result.available || !result.rows.length) return { available: result.available, campaigns: [] }

  const campaignIds = result.rows.map((row) => row.campaign_id)
  const schedules = await pool.query(`
    SELECT campaign_id, segment_id, scheduled_at::date::text AS send_date,
      count(*) FILTER (WHERE status = 'sent')::integer AS contacted
    FROM ${workflowSchemaSql}.outbound_campaign_contacts
    WHERE campaign_id = ANY($1::uuid[]) AND scheduled_at IS NOT NULL
    GROUP BY campaign_id, segment_id, scheduled_at::date
  `, [campaignIds])
  const countsByCampaign = new Map()
  for (const row of schedules.rows) {
    if (!countsByCampaign.has(String(row.campaign_id))) countsByCampaign.set(String(row.campaign_id), new Map())
    countsByCampaign.get(String(row.campaign_id)).set(`${row.segment_id}:${row.send_date}`, asNumber(row.contacted) || 0)
  }

  return {
    available: true,
    campaigns: result.rows.map((row) => {
      const accepted = asNumber(row.accepted_contacts) || 0
      const notSelected = asNumber(row.not_selected) || 0
      const pending = (asNumber(row.pending_segmentation) || 0) + (asNumber(row.segmenting) || 0)
      const selected = Math.max(accepted - notSelected - pending, 0)
      const issues = Array.isArray(row.delivery_issues) ? row.delivery_issues : []
      return {
        id: String(row.campaign_id),
        externalId: row.external_id,
        title: row.plan?.campaign_summary || row.external_id || row.source_filename,
        filename: row.source_filename,
        createdAt: iso(row.created_at),
        completedAt: iso(row.completed_at),
        csvRows: null,
        csvValid: accepted,
        prompt: row.prompt,
        status: campaignStatus(row.status),
        workflowStatus: row.status,
        selectedCompanies: selected,
        companiesContacted: asNumber(row.sent) || 0,
        replies: null,
        interested: null,
        nextScheduledAt: iso(row.next_scheduled_at),
        days: planDays(row.plan, countsByCampaign.get(String(row.campaign_id)) || new Map()),
        deliveryIssues: issues.map((issue) => ({
          id: String(issue.id),
          company: issue.company,
          email: issue.email,
          segment: issue.segment,
          reason: issueReason({ status: issue.status, last_error: issue.lastError }),
          attemptedAt: iso(issue.attemptedAt),
        })),
      }
    }),
  }
}

export async function getConversations(limit) {
  const result = await availableQuery('ficharia_conversation_lead_inbox', `
    SELECT inbox.*,
      COALESCE(messages.items, '[]'::jsonb) AS incoming_messages
    FROM ${workflowSchemaSql}.ficharia_conversation_lead_inbox inbox
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.email_message_id,
        'messageId', m.message_id,
        'subject', m.subject,
        'receivedAt', m.received_at,
        'status', m.status,
        'classification', m.classification,
        'confidence', m.classification_confidence,
        'summary', left(regexp_replace(m.normalized_text, E'[\\r\\n\\t ]+', ' ', 'g'), 500),
        'hasError', m.error <> '{}'::jsonb
      ) ORDER BY m.received_at DESC) AS items
      FROM (
        SELECT *
        FROM ${workflowSchemaSql}.email_messages
        WHERE conversation_id = inbox.conversation_id AND direction = 'incoming'
        ORDER BY received_at DESC
        LIMIT 50
      ) m
    ) messages ON true
    ORDER BY inbox.attention_rank, inbox.last_activity_at DESC
    LIMIT $1
  `, [limit])

  return {
    available: result.available,
    conversations: result.rows.map((row) => ({
      id: String(row.conversation_id),
      contact: row.contact_name || row.contact_email,
      company: row.company || row.domain || 'Sin empresa',
      email: row.contact_email,
      status: row.conversation_status,
      intent: row.current_intent,
      summary: row.summary,
      lastActivity: iso(row.last_activity_at),
      incomingCount: asNumber(row.incoming_message_count) || 0,
      outgoingCount: asNumber(row.outgoing_message_count) || 0,
      emails: (Array.isArray(row.incoming_messages) ? row.incoming_messages : []).map((message) => ({
        id: String(message.id),
        messageId: message.messageId,
        subject: message.subject || '(Sin asunto)',
        receivedAt: iso(message.receivedAt),
        status: message.hasError ? 'failed' : ['received', 'processing'].includes(message.status) ? 'active' : 'completed',
        classification: message.classification,
        confidence: asNumber(message.confidence),
        summary: message.summary || 'Sin resumen disponible.',
      })),
    })),
  }
}

export async function getFollowups(limit) {
  const result = await availableQuery('ficharia_weekly_followup_status', `
    SELECT f.*, inbox.contact_name, inbox.company, inbox.domain
    FROM ${workflowSchemaSql}.ficharia_weekly_followup_status f
    LEFT JOIN ${workflowSchemaSql}.ficharia_conversation_lead_inbox inbox
      ON inbox.conversation_id = f.conversation_id
    ORDER BY
      CASE WHEN f.status = 'pending' THEN 0 ELSE 1 END,
      COALESCE(f.next_attempt_at, f.sent_at, f.updated_at) DESC
    LIMIT $1
  `, [limit])

  const grouped = new Map()
  for (const row of result.rows) {
    const id = String(row.conversation_id)
    if (!grouped.has(id)) {
      grouped.set(id, {
        id,
        contact: row.contact_name || row.contact_email,
        company: row.company || row.domain || 'Sin empresa',
        email: row.contact_email,
        state: ['pending', 'generating', 'sending'].includes(row.status) ? 'waiting' : row.response_detected_at ? 'replied' : 'closed',
        nextFollowUpAt: null,
        followUpCount: 0,
        events: [],
      })
    }
    const item = grouped.get(id)
    item.followUpCount = Math.max(item.followUpCount, asNumber(row.followup_number) || 0)
    if (['pending', 'generating', 'sending'].includes(row.status)) {
      const next = iso(row.next_attempt_at || row.due_at)
      if (!item.nextFollowUpAt || (next && next < item.nextFollowUpAt)) item.nextFollowUpAt = next
    }
    item.events.push({
      id: String(row.job_id),
      followUpNumber: asNumber(row.followup_number) || 0,
      status: row.status,
      dueAt: iso(row.due_at),
      sentAt: iso(row.sent_at),
      responseDetectedAt: iso(row.response_detected_at),
      cancellationReason: row.cancellation_reason,
      error: row.last_error && Object.keys(row.last_error).length ? row.last_error : null,
    })
  }

  return { available: result.available, conversations: [...grouped.values()] }
}

export async function getCreatives(limit) {
  const result = await availableQuery('ficharia_creative_library', `
    SELECT creative_id, external_id, prompt, status, image_url, image_mime_type,
      image_width, image_height, is_active, generated_at, approved_at,
      rejected_at, activated_at, created_at, updated_at
    FROM ${workflowSchemaSql}.ficharia_creative_library
    ORDER BY created_at DESC
    LIMIT $1
  `, [limit])

  return {
    available: result.available,
    assets: result.rows.map((row) => ({
      id: String(row.creative_id),
      externalId: row.external_id,
      title: row.external_id || `Creatividad ${String(row.creative_id).slice(0, 8)}`,
      prompt: row.prompt,
      status: row.status,
      image: row.image_url,
      imageMimeType: row.image_mime_type,
      width: asNumber(row.image_width),
      height: asNumber(row.image_height),
      isActive: row.is_active,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
    })),
  }
}

export async function getJobs(limit) {
  const result = await availableQuery('ficharia_dashboard_jobs', `
    SELECT job_id, job_type, external_id, status, processing, progress_percent,
      attempt_count, next_attempt_at, lease_expires_at, error, result,
      created_at, updated_at, completed_at
    FROM ${workflowSchemaSql}.ficharia_dashboard_jobs
    ORDER BY updated_at DESC
    LIMIT $1
  `, [limit])

  return {
    available: result.available,
    jobs: result.rows.map((row) => ({
      id: row.job_id,
      type: row.job_type,
      externalId: row.external_id,
      status: row.status,
      processing: row.processing,
      progressPercent: asNumber(row.progress_percent) || 0,
      attemptCount: asNumber(row.attempt_count) || 0,
      nextAttemptAt: iso(row.next_attempt_at),
      leaseExpiresAt: iso(row.lease_expires_at),
      error: row.error,
      result: row.result,
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      completedAt: iso(row.completed_at),
    })),
  }
}
