import pg from 'pg'

if (!process.env.DATABASE_URL?.trim()) throw new Error('DATABASE_URL no está configurada.')

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'disable'
    ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
  max: 1,
})

try {
  const result = await pool.query(`
    SELECT
      (SELECT count(*)::integer FROM public.conversations) AS conversations,
      (SELECT count(*)::integer FROM public.email_messages) AS messages,
      (SELECT count(*)::integer FROM public.workflow_events) AS events,
      (SELECT max(updated_at) FROM public.conversations) AS last_conversation_update,
      (SELECT max(received_at) FROM public.email_messages) AS last_message_received,
      (SELECT max(occurred_at) FROM public.workflow_events) AS last_event
  `)
  const optionalRelations = [
    'outbound_campaigns',
    'outbound_campaign_contacts',
    'weekly_followup_jobs',
    'creative_assets',
    'ficharia_dashboard_jobs',
  ]
  const optionalCounts = {}
  for (const relation of optionalRelations) {
    const exists = await pool.query('SELECT to_regclass($1) IS NOT NULL AS exists', [`public.${relation}`])
    optionalCounts[relation] = exists.rows[0].exists
      ? Number((await pool.query(`SELECT count(*)::integer AS total FROM public.${relation}`)).rows[0].total)
      : null
  }
  process.stdout.write(`${JSON.stringify({ checkedAt: new Date().toISOString(), ...result.rows[0], ...optionalCounts })}\n`)
} finally {
  await pool.end()
}
