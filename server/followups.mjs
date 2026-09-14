// Read-only projection of the weekly worker. Keep these defaults aligned with
// Config | Seguimiento semanal and Schedule | Revisar cada semana in n8n.
export const followupStartAfter = process.env.FICHARIA_FOLLOWUP_START_AFTER?.trim() || '2026-09-10T22:00:00.000Z'
if (!Number.isFinite(Date.parse(followupStartAfter))) throw new Error('FICHARIA_FOLLOWUP_START_AFTER debe ser una fecha ISO válida.')

export function followupQuery(schema) {
  return `
    WITH latest_outgoing AS (
      SELECT DISTINCT ON (to_email) *
      FROM ${schema}.email_messages
      WHERE direction = 'outgoing' AND status = 'sent' AND sent_at IS NOT NULL
      ORDER BY to_email, sent_at DESC, created_at DESC,
        CASE WHEN idempotency_key LIKE 'weekly-followup:%' THEN 1 ELSE 0 END DESC,
        email_message_id DESC
    ), context AS (
      SELECT c.conversation_id, c.contact_email, inbox.contact_name, inbox.company, inbox.domain,
        c.updated_at, bardo.sent_at AS last_bardo_message_at,
        parent.sent_at AS last_sent_at, incoming.received_at AS response_at,
        job.status AS parent_job_status, job.due_at AS job_due_at,
        job.next_attempt_at, job.response_detected_at,
        parent.sent_at + interval '7 days' AS candidate_due_at,
        COALESCE(history.events, '[]'::jsonb) AS events,
        COALESCE(history.sent_count, 0) AS sent_count,
        COALESCE(
          latest.conversation_id = c.conversation_id
          AND (latest.idempotency_key LIKE 'live-reply:%' OR latest.idempotency_key LIKE 'weekly-followup:%')
          AND (job.job_id IS NOT NULL OR bardo.sent_at >= $2::timestamptz)
          AND c.automation_enabled AND c.status IN ('awaiting_customer', 'responded')
          AND NOT COALESCE(lead.do_not_contact, false)
          AND incoming.received_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM ${schema}.suppression_list s
            WHERE s.email_normalized = c.contact_email AND s.status = 'active'
          )
          AND NOT EXISTS (
            SELECT 1 FROM ${schema}.weekly_followup_jobs source_job
            WHERE source_job.outgoing_email_message_id = latest.email_message_id
              AND source_job.response_detected_at IS NOT NULL
          )
          AND EXISTS (
            SELECT 1 FROM ${schema}.email_messages original
            JOIN ${schema}.email_messages reply
              ON reply.conversation_id = original.conversation_id
              AND reply.parent_message_id = original.message_id
              AND reply.direction = 'outgoing' AND reply.status = 'sent' AND reply.sent_at IS NOT NULL
              AND reply.idempotency_key LIKE 'live-reply:%'
              AND lower(reply.to_email) = lower(c.contact_email)
            WHERE original.conversation_id = c.conversation_id
              AND original.direction = 'incoming' AND lower(original.from_email) = lower(c.contact_email)
          ), false
        ) AS eligible
      FROM ${schema}.conversations c
      LEFT JOIN ${schema}.ficharia_conversation_lead_inbox inbox USING (conversation_id)
      LEFT JOIN ${schema}.lead_state lead USING (conversation_id)
      LEFT JOIN latest_outgoing latest ON latest.to_email = c.contact_email
      LEFT JOIN LATERAL (
        SELECT sent_at FROM ${schema}.email_messages
        WHERE conversation_id = c.conversation_id AND direction = 'outgoing'
          AND status = 'sent' AND idempotency_key LIKE 'live-reply:%'
        ORDER BY sent_at DESC, created_at DESC LIMIT 1
      ) bardo ON true
      LEFT JOIN LATERAL (
        SELECT message_id, sent_at FROM ${schema}.email_messages
        WHERE conversation_id = c.conversation_id AND direction = 'outgoing' AND status = 'sent'
        ORDER BY sent_at DESC, created_at DESC,
          CASE WHEN idempotency_key LIKE 'weekly-followup:%' THEN 1 ELSE 0 END DESC,
          email_message_id DESC LIMIT 1
      ) parent ON true
      LEFT JOIN ${schema}.weekly_followup_jobs job ON job.parent_message_id = parent.message_id
      LEFT JOIN LATERAL (
        SELECT min(GREATEST(received_at, created_at)) AS received_at
        FROM ${schema}.email_messages
        WHERE direction = 'incoming' AND from_email = c.contact_email
          AND GREATEST(received_at, created_at) > parent.sent_at
      ) incoming ON true
      LEFT JOIN LATERAL (
        SELECT count(*) FILTER (WHERE status = 'sent' AND sent_at IS NOT NULL) AS sent_count,
          jsonb_agg(jsonb_build_object(
            'id', job_id, 'followUpNumber', followup_number, 'status', status,
            'dueAt', due_at, 'sentAt', sent_at, 'updatedAt', updated_at,
            'responseDetectedAt', response_detected_at, 'cancellationReason', cancellation_reason,
            'error', CASE WHEN last_error = '{}'::jsonb THEN NULL ELSE last_error END
          ) ORDER BY followup_number) AS events
        FROM ${schema}.ficharia_weekly_followup_status f
        WHERE f.conversation_id = c.conversation_id
      ) history ON true
    ), scheduled AS (
      SELECT *,
        GREATEST(COALESCE(next_attempt_at, job_due_at, candidate_due_at), $3::timestamptz)
          AT TIME ZONE 'Europe/Madrid' AS review_after
      FROM context
      WHERE events <> '[]'::jsonb OR (eligible AND parent_job_status IS NULL)
    ), reviews AS (
      SELECT *, date_trunc('week', review_after) + interval '10 hours' AS monday_at_ten
      FROM scheduled
    )
    SELECT *, (
      monday_at_ten + CASE WHEN monday_at_ten < review_after THEN interval '7 days' ELSE interval '0 days' END
    ) AT TIME ZONE 'Europe/Madrid' AS next_review_at
    FROM reviews
    ORDER BY CASE WHEN eligible AND (parent_job_status IS NULL OR parent_job_status IN ('pending', 'generating', 'sending')) THEN 0 ELSE 1 END,
      CASE WHEN eligible THEN COALESCE(next_attempt_at, job_due_at, candidate_due_at) END ASC NULLS LAST,
      updated_at DESC, conversation_id
    LIMIT $1
  `
}

function iso(value) {
  return value ? new Date(value).toISOString() : null
}

export function mapFollowup(row) {
  const events = row.events
  const latest = events.at(-1)
  const responseAt = iso(row.response_at || (
    latest?.responseDetectedAt && new Date(latest.responseDetectedAt) > new Date(row.last_sent_at || 0)
      ? latest.responseDetectedAt : null
  ))
  let state = 'closed'
  // Sending has already crossed the delivery boundary; a reply cannot undo it.
  if (row.parent_job_status === 'sending') state = 'sending'
  else if (responseAt) state = 'replied'
  else if (row.eligible && (!row.parent_job_status || ['pending', 'generating'].includes(row.parent_job_status))) {
    state = row.parent_job_status === 'generating' ? 'generating' : 'waiting'
  } else if (latest?.status === 'delivery_unknown') state = 'needs-review'
  else if (latest?.status === 'failed') state = 'failed'

  return {
    id: String(row.conversation_id),
    contact: row.contact_name || row.contact_email,
    company: row.company || row.domain || 'Sin empresa',
    email: row.contact_email,
    state,
    lastBardoMessageAt: iso(row.last_bardo_message_at),
    responseDetectedAt: responseAt,
    eligibleAt: state === 'waiting' ? iso(row.job_due_at || row.candidate_due_at) : null,
    nextFollowUpAt: state === 'waiting' ? iso(row.next_review_at) : null,
    followUpCount: Number(row.sent_count),
    events: events.map((event) => ({
      ...event,
      dueAt: iso(event.dueAt), sentAt: iso(event.sentAt), updatedAt: iso(event.updatedAt),
      responseDetectedAt: iso(event.responseDetectedAt),
    })),
  }
}
