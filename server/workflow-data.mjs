import { pool, workflowSchema, workflowSchemaSql } from './database.mjs'
import { followupQuery, followupStartAfter, mapFollowup } from './followups.mjs'

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
  if (status === 'completed_with_errors') return 'partial'
  if (status === 'needs_review') return 'needs-review'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'paused') return 'paused'
  if (status === 'failed') return 'failed'
  if (['received', 'queued', 'pending'].includes(status)) return 'queued'
  return 'running'
}

function errorDetail(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.keys(value).length) return null
  const code = value.code == null ? null : String(value.code)
  const message = value.message == null ? null : String(value.message)
  if (!code && !message) return null
  return { code, message }
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
      c.last_error,
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

  const replies = await pool.query(`
    SELECT
      x.campaign_id,
      count(DISTINCT x.contact_id)::integer AS replies,
      count(DISTINCT x.contact_id) FILTER (
        WHERE incoming.classification = ANY($2::text[])
      )::integer AS interested
    FROM ${workflowSchemaSql}.outbound_campaign_contacts x
    JOIN ${workflowSchemaSql}.email_messages incoming
      ON incoming.direction = 'incoming'
      AND (
        incoming.in_reply_to = x.provider_message_id
        OR incoming.parent_message_id = x.provider_message_id
      )
    WHERE x.campaign_id = ANY($1::uuid[])
    GROUP BY x.campaign_id
  `, [campaignIds, [
    'demo_request',
    'pricing_request',
    'general_information',
    'feature_question',
    'integration_question',
    'partner_or_collaboration',
    'conversation_reply',
  ]])
  const repliesByCampaign = new Map(replies.rows.map((row) => [String(row.campaign_id), {
    replies: asNumber(row.replies) || 0,
    interested: asNumber(row.interested) || 0,
  }]))

  return {
    available: true,
    campaigns: result.rows.map((row) => {
      const accepted = asNumber(row.accepted_contacts) || 0
      const notSelected = asNumber(row.not_selected) || 0
      const pending = (asNumber(row.pending_segmentation) || 0) + (asNumber(row.segmenting) || 0)
      const selected = Math.max(accepted - notSelected - pending, 0)
      const issues = Array.isArray(row.delivery_issues) ? row.delivery_issues : []
      const responseCounts = repliesByCampaign.get(String(row.campaign_id)) || { replies: 0, interested: 0 }
      return {
        id: String(row.campaign_id),
        externalId: row.external_id,
        title: row.plan?.campaign_summary || row.external_id || row.source_filename,
        filename: row.source_filename,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        completedAt: iso(row.completed_at),
        csvRows: null,
        csvValid: accepted,
        prompt: row.prompt,
        status: campaignStatus(row.status),
        workflowStatus: row.status,
        lastError: errorDetail(row.last_error),
        execution: {
          pendingSegmentation: asNumber(row.pending_segmentation) || 0,
          segmenting: asNumber(row.segmenting) || 0,
          notSelected,
          scheduled: asNumber(row.scheduled) || 0,
          sending: asNumber(row.sending) || 0,
          sent: asNumber(row.sent) || 0,
          suppressed: asNumber(row.suppressed) || 0,
          capacityExhausted: asNumber(row.capacity_exhausted) || 0,
          deliveryUnknown: asNumber(row.delivery_unknown) || 0,
          failed: asNumber(row.failed) || 0,
        },
        selectedCompanies: selected,
        companiesContacted: asNumber(row.sent) || 0,
        replies: responseCounts.replies,
        interested: responseCounts.interested,
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

const campaignContactFilters = {
  all: 'TRUE',
  sent: "x.status = 'sent'",
  pending: "x.status IN ('pending_segmentation', 'segmenting', 'scheduled', 'sending')",
  issues: "x.status IN ('suppressed', 'capacity_exhausted', 'delivery_unknown', 'failed')",
  'not-selected': "x.status = 'not_selected'",
}

export async function getCampaignContacts({ campaignId, limit, offset, query, status }) {
  const statusFilter = campaignContactFilters[status] || campaignContactFilters.all
  const result = await availableQuery('outbound_campaign_contacts', `
    SELECT
      x.contact_id,
      x.email_normalized,
      x.contact_data,
      x.status,
      x.segment_id,
      x.match_score,
      x.match_reason,
      x.email_subject,
      left(COALESCE(x.email_opening, ''), 8000) AS email_opening,
      left(COALESCE(x.email_cta, ''), 4000) AS email_cta,
      x.scheduled_at,
      x.send_attempt_count,
      x.next_attempt_at,
      x.last_send_attempt_at,
      x.provider_message_id,
      x.last_error,
      x.sent_at,
      x.updated_at,
      reply.item AS reply,
      count(*) OVER()::integer AS total_count
    FROM ${workflowSchemaSql}.outbound_campaign_contacts x
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', incoming.email_message_id,
        'subject', incoming.subject,
        'receivedAt', incoming.received_at,
        'classification', incoming.classification,
        'confidence', incoming.classification_confidence
      ) AS item
      FROM ${workflowSchemaSql}.email_messages incoming
      WHERE incoming.direction = 'incoming'
        AND (
          incoming.in_reply_to = x.provider_message_id
          OR incoming.parent_message_id = x.provider_message_id
        )
      ORDER BY incoming.received_at ASC NULLS LAST
      LIMIT 1
    ) reply ON true
    WHERE x.campaign_id = $1
      AND ${statusFilter}
      AND (
        $2 = ''
        OR x.email_normalized ILIKE '%' || $2 || '%'
        OR COALESCE(x.contact_data->>'company', x.contact_data->>'empresa', '') ILIKE '%' || $2 || '%'
        OR COALESCE(x.contact_data->>'name', x.contact_data->>'nombre', x.contact_data->>'contact_name', '') ILIKE '%' || $2 || '%'
        OR COALESCE(x.email_subject, '') ILIKE '%' || $2 || '%'
        OR COALESCE(x.last_error->>'message', '') ILIKE '%' || $2 || '%'
      )
    ORDER BY
      CASE x.status
        WHEN 'failed' THEN 1
        WHEN 'delivery_unknown' THEN 2
        WHEN 'capacity_exhausted' THEN 3
        WHEN 'suppressed' THEN 4
        WHEN 'sending' THEN 5
        WHEN 'scheduled' THEN 6
        WHEN 'sent' THEN 7
        ELSE 8
      END,
      COALESCE(x.sent_at, x.last_send_attempt_at, x.scheduled_at, x.updated_at) DESC
    LIMIT $3 OFFSET $4
  `, [campaignId, query, limit, offset])

  return {
    available: result.available,
    total: asNumber(result.rows[0]?.total_count) || 0,
    contacts: result.rows.map((row) => {
      const contactData = row.contact_data && typeof row.contact_data === 'object' ? row.contact_data : {}
      const reply = row.reply && typeof row.reply === 'object' ? row.reply : null
      const hasEmailContent = Boolean(row.email_subject || row.email_opening || row.email_cta)
      return {
        id: String(row.contact_id),
        company: contactData.company || contactData.empresa || 'Empresa sin nombre',
        name: contactData.name || contactData.nombre || contactData.contact_name || null,
        email: row.email_normalized,
        segment: row.segment_id || null,
        status: row.status,
        matchScore: asNumber(row.match_score),
        matchReason: row.match_reason || null,
        scheduledAt: iso(row.scheduled_at),
        nextAttemptAt: iso(row.next_attempt_at),
        attemptedAt: iso(row.last_send_attempt_at),
        sentAt: iso(row.sent_at),
        sendAttemptCount: asNumber(row.send_attempt_count) || 0,
        providerMessageId: row.provider_message_id || null,
        error: errorDetail(row.last_error),
        emailContent: hasEmailContent ? {
          subject: row.email_subject || '(Sin asunto)',
          opening: row.email_opening || '',
          cta: row.email_cta || '',
        } : null,
        reply: reply ? {
          id: String(reply.id),
          subject: reply.subject || '(Sin asunto)',
          receivedAt: iso(reply.receivedAt),
          classification: reply.classification || null,
          confidence: asNumber(reply.confidence),
        } : null,
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
    ORDER BY inbox.last_activity_at DESC NULLS LAST, inbox.attention_rank, inbox.conversation_id
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

export async function getConversationEmail(emailId) {
  const result = await availableQuery('email_messages', `
    SELECT
      incoming.email_message_id,
      incoming.message_id,
      incoming.subject,
      incoming.received_at,
      incoming.status,
      incoming.classification,
      incoming.classification_confidence,
      incoming.error,
      incoming.from_email,
      incoming.to_email,
      left(COALESCE(NULLIF(incoming.body_text, ''), incoming.normalized_text, ''), 12000) AS incoming_body,
      left(regexp_replace(incoming.normalized_text, E'[\\r\\n\\t ]+', ' ', 'g'), 500) AS summary,
      reply.item AS reply
    FROM ${workflowSchemaSql}.email_messages incoming
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'id', outgoing.email_message_id,
        'messageId', outgoing.message_id,
        'subject', outgoing.subject,
        'sentAt', COALESCE(outgoing.sent_at, outgoing.created_at),
        'status', outgoing.status,
        'fromEmail', outgoing.from_email,
        'toEmail', outgoing.to_email,
        'body', left(COALESCE(NULLIF(outgoing.body_text, ''), outgoing.normalized_text, ''), 12000)
      ) AS item
      FROM ${workflowSchemaSql}.email_messages outgoing
      WHERE outgoing.conversation_id = incoming.conversation_id
        AND outgoing.direction = 'outgoing'
        AND (outgoing.parent_message_id = incoming.message_id OR outgoing.in_reply_to = incoming.message_id)
      ORDER BY COALESCE(outgoing.sent_at, outgoing.created_at) ASC
      LIMIT 1
    ) reply ON true
    WHERE incoming.email_message_id = $1
      AND incoming.direction = 'incoming'
    LIMIT 1
  `, [emailId])

  const row = result.rows[0]
  if (!row) return { available: result.available, email: null }

  return {
    available: result.available,
    email: {
      id: String(row.email_message_id),
      messageId: row.message_id || '',
      subject: row.subject || '(Sin asunto)',
      receivedAt: iso(row.received_at),
      status: row.error && Object.keys(row.error).length
        ? 'failed'
        : ['received', 'processing'].includes(row.status) ? 'active' : 'completed',
      classification: row.classification,
      confidence: asNumber(row.classification_confidence),
      summary: row.summary || 'Sin resumen disponible.',
      incoming: {
        fromEmail: row.from_email || '',
        toEmail: row.to_email || '',
        body: row.incoming_body || row.summary || 'Contenido no disponible.',
      },
      reply: row.reply ? {
        id: String(row.reply.id),
        messageId: row.reply.messageId || '',
        subject: row.reply.subject || row.subject || '(Sin asunto)',
        sentAt: iso(row.reply.sentAt),
        status: row.reply.status || 'sent',
        fromEmail: row.reply.fromEmail || '',
        toEmail: row.reply.toEmail || row.from_email || '',
        body: row.reply.body || 'Contenido no disponible.',
      } : null,
    },
  }
}

export async function getFollowups(limit) {
  const result = await availableQuery('ficharia_weekly_followup_status', followupQuery(workflowSchemaSql),
    [limit, followupStartAfter, new Date().toISOString()])
  return { available: result.available, conversations: result.rows.map(mapFollowup) }
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
