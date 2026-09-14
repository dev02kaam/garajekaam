import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import pg from 'pg'
import { followupQuery, mapFollowup } from '../server/followups.mjs'

// Use a disposable PostgreSQL database, never DATABASE_URL or the shared data.
if (!process.env.FOLLOWUP_TEST_DATABASE_URL) throw new Error('Configura FOLLOWUP_TEST_DATABASE_URL con un PostgreSQL de pruebas.')
const client = new pg.Client({ connectionString: process.env.FOLLOWUP_TEST_DATABASE_URL })
const startAfter = '2026-09-10T22:00:00Z'
const checkedAt = '2026-09-14T12:00:00Z'
let serial = 0

before(async () => {
  await client.connect()
  await client.query(`
    CREATE TEMP TABLE conversations (conversation_id text PRIMARY KEY, contact_email text,
      automation_enabled boolean DEFAULT true, status text DEFAULT 'awaiting_customer', updated_at timestamptz DEFAULT now());
    CREATE TEMP TABLE email_messages (email_message_id text PRIMARY KEY, conversation_id text,
      message_id text UNIQUE, parent_message_id text, direction text, status text, idempotency_key text,
      from_email text, to_email text, sent_at timestamptz, received_at timestamptz, created_at timestamptz);
    CREATE TEMP TABLE lead_state (conversation_id text PRIMARY KEY, do_not_contact boolean DEFAULT false);
    CREATE TEMP TABLE suppression_list (email_normalized text, status text);
    CREATE TEMP TABLE ficharia_conversation_lead_inbox (conversation_id text PRIMARY KEY, contact_name text, company text, domain text);
    CREATE TEMP TABLE weekly_followup_jobs (job_id text PRIMARY KEY, conversation_id text, parent_message_id text UNIQUE,
      outgoing_email_message_id text, followup_number int, status text, due_at timestamptz, next_attempt_at timestamptz,
      sent_at timestamptz, response_detected_at timestamptz, cancellation_reason text, last_error jsonb DEFAULT '{}', updated_at timestamptz DEFAULT now());
    CREATE TEMP VIEW ficharia_weekly_followup_status AS SELECT * FROM weekly_followup_jobs;
  `)
})
after(async () => { await client.end() })
beforeEach(async () => {
  serial = 0
  await client.query('TRUNCATE pg_temp.conversations, pg_temp.email_messages, pg_temp.lead_state, pg_temp.suppression_list, pg_temp.ficharia_conversation_lead_inbox, pg_temp.weekly_followup_jobs')
})

async function message(conversation, { direction = 'outgoing', status = 'sent', at, key = 'live-reply:', parent = null } = {}) {
  const id = `message-${++serial}`
  const email = `${conversation}@example.com`
  await client.query(`INSERT INTO pg_temp.email_messages VALUES ($1,$2,$1,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
    id, conversation, parent, direction, status, key + id,
    direction === 'incoming' ? email : 'bardo@example.com', direction === 'incoming' ? 'bardo@example.com' : email,
    direction === 'outgoing' ? at : null, direction === 'incoming' ? at : null, at,
  ])
  return id
}

async function exchange(id = 'a', at = '2026-09-11T10:47:00Z') {
  await client.query('INSERT INTO pg_temp.conversations (conversation_id,contact_email) VALUES ($1,$2)', [id, `${id}@example.com`])
  const incoming = await message(id, { direction: 'incoming', status: 'processed', at: new Date(Date.parse(at) - 60_000).toISOString() })
  return message(id, { at, parent: incoming })
}

async function job(conversation, parent, { status = 'pending', number = 1, outgoing = null, sentAt = null, dueAt = '2026-09-18T10:47:00Z', responseAt = null } = {}) {
  await client.query(`INSERT INTO pg_temp.weekly_followup_jobs
    (job_id,conversation_id,parent_message_id,followup_number,status,due_at,next_attempt_at,outgoing_email_message_id,sent_at,response_detected_at)
    VALUES ($1,$2,$3,$4,$5,$6,$6,$7,$8,$9)`, [`job-${++serial}`, conversation, parent, number, status, dueAt, outgoing, sentAt, responseAt])
}

async function read({ limit = 200, now = checkedAt } = {}) {
  return (await client.query(followupQuery('pg_temp'), [limit, startAfter, now])).rows.map(mapFollowup)
}

test('anticipa el primer seguimiento sin crear jobs y proyecta el lunes posterior', async () => {
  await exchange()
  const [result] = await read()
  assert.equal(result.state, 'waiting')
  assert.equal(result.followUpCount, 0)
  assert.equal(result.eligibleAt, '2026-09-18T10:47:00.000Z')
  assert.equal(result.nextFollowUpAt, '2026-09-21T08:00:00.000Z')
  assert.equal(result.lastBardoMessageAt, '2026-09-11T10:47:00.000Z')
  assert.equal((await client.query('SELECT count(*)::int AS count FROM pg_temp.weekly_followup_jobs')).rows[0].count, 0)
})

test('excluye campañas, intercambios incompletos, históricos y contactos dados de baja', async () => {
  await exchange('old', '2026-09-09T08:00:00Z')
  await exchange('suppressed')
  await client.query("INSERT INTO pg_temp.suppression_list VALUES ('suppressed@example.com','active')")
  await exchange('paused')
  await client.query("UPDATE pg_temp.conversations SET automation_enabled=false WHERE conversation_id='paused'")
  await exchange('do-not-contact')
  await client.query("INSERT INTO pg_temp.lead_state VALUES ('do-not-contact',true)")
  await exchange('campaign')
  await message('campaign', { at: '2026-09-12T09:00:00Z', key: 'campaign:' })
  await client.query("INSERT INTO pg_temp.conversations (conversation_id,contact_email) VALUES ('orphan','orphan@example.com')")
  await message('orphan', { at: '2026-09-11T10:00:00Z' })
  assert.deepEqual(await read(), [])
})

test('un job pendiente no cuenta como enviado y conserva su reintento', async () => {
  const parent = await exchange()
  await job('a', parent, { number: 5 })
  await client.query("UPDATE pg_temp.weekly_followup_jobs SET next_attempt_at='2026-09-22T09:00:00Z'")
  const [result] = await read()
  assert.equal(result.followUpCount, 0)
  assert.equal(result.state, 'waiting')
  assert.equal(result.nextFollowUpAt, '2026-09-28T08:00:00.000Z')
})

test('la fecha de inicio no oculta trabajos que el flujo ya había programado', async () => {
  const parent = await exchange('previous', '2026-09-09T08:00:00Z')
  await job('previous', parent)
  assert.equal((await read())[0].state, 'waiting')
})

test('un envío confirmado sigue en espera del próximo ciclo y mantiene el mensaje real de El Bardo', async () => {
  const parent = await exchange()
  const sentAt = '2026-09-21T08:00:00Z'
  const outgoing = await message('a', { at: sentAt, key: 'weekly-followup:', parent })
  await job('a', parent, { status: 'sent', outgoing, sentAt })
  const [result] = await read({ now: '2026-09-21T08:01:00Z' })
  assert.equal(result.state, 'waiting')
  assert.equal(result.followUpCount, 1)
  assert.equal(result.nextFollowUpAt, '2026-09-28T08:00:00.000Z')
  assert.equal(result.lastBardoMessageAt, '2026-09-11T10:47:00.000Z')
})

test('una respuesta en otro hilo retira la espera sin depender de la ejecución semanal', async () => {
  const parent = await exchange()
  await job('a', parent)
  await message('other-thread', { direction: 'incoming', status: 'received', at: '2026-09-12T08:00:00Z' })
  await client.query("UPDATE pg_temp.email_messages SET from_email='a@example.com' WHERE conversation_id='other-thread'")
  const [result] = await read()
  assert.equal(result.state, 'replied')
  assert.equal(result.responseDetectedAt, '2026-09-12T08:00:00.000Z')
  assert.equal(result.nextFollowUpAt, null)
})

test('bajas y cancelaciones no se confunden con una respuesta', async () => {
  const parent = await exchange()
  await job('a', parent)
  await client.query("INSERT INTO pg_temp.suppression_list VALUES ('a@example.com','active')")
  assert.equal((await read())[0].state, 'closed')
  await client.query("UPDATE pg_temp.weekly_followup_jobs SET status='cancelled', cancellation_reason='suppression_list'")
  assert.equal((await read())[0].state, 'closed')
  assert.equal((await read())[0].followUpCount, 0)
})

test('distingue generación, envío, fallo y entrega sin confirmar', async () => {
  const parent = await exchange()
  await job('a', parent)
  for (const [status, expected] of [['generating','generating'], ['sending','sending'], ['failed','failed'], ['delivery_unknown','needs-review']]) {
    await client.query('UPDATE pg_temp.weekly_followup_jobs SET status=$1', [status])
    const [result] = await read()
    assert.equal(result.state, expected)
    assert.equal(result.followUpCount, 0)
    assert.equal(result.nextFollowUpAt, null)
  }
})

test('el límite se aplica a conversaciones completas y prioriza el vencimiento más cercano', async () => {
  const first = await exchange('first', '2026-09-11T07:00:00Z')
  await exchange('later', '2026-09-12T07:00:00Z')
  let parent = first
  for (let i = 1; i <= 4; i++) {
    const sentAt = `2026-09-${11 + i}T07:00:00Z`
    const outgoing = await message('first', { at: sentAt, key: 'weekly-followup:', parent })
    await job('first', parent, { status: 'sent', number: i, outgoing, sentAt })
    parent = outgoing
  }
  const results = await read({ limit: 1 })
  assert.equal(results[0].id, 'later')
  await client.query("UPDATE pg_temp.conversations SET automation_enabled=false WHERE conversation_id='later'")
  const [history] = await read({ limit: 1 })
  assert.equal(history.events.length, 4)
  assert.equal(history.followUpCount, 4)
})

test('la revisión respeta el cambio de hora de Madrid y el corte del lunes', async () => {
  await exchange('autumn', '2026-10-23T10:00:00Z')
  const [autumn] = await read({ now: '2026-10-24T12:00:00Z' })
  assert.equal(autumn.nextFollowUpAt, '2026-11-02T09:00:00.000Z')
  await client.query("UPDATE pg_temp.email_messages SET sent_at='2026-10-19T08:00:00Z', created_at='2026-10-19T08:00:00Z' WHERE direction='outgoing'")
  await client.query("UPDATE pg_temp.email_messages SET received_at='2026-10-19T07:59:00Z', created_at='2026-10-19T07:59:00Z' WHERE direction='incoming'")
  assert.equal((await read({ now: '2026-10-26T09:00:00Z' }))[0].nextFollowUpAt, '2026-10-26T09:00:00.000Z')
  assert.equal((await read({ now: '2026-10-26T09:00:01Z' }))[0].nextFollowUpAt, '2026-11-02T09:00:00.000Z')
})

test('un nuevo intercambio puede reabrir el seguimiento sin arrastrar una respuesta anterior', async () => {
  const parent = await exchange()
  await job('a', parent, { status: 'cancelled', responseAt: '2026-09-12T08:00:00Z' })
  const incoming = await message('a', { direction: 'incoming', status: 'processed', at: '2026-09-12T08:00:00Z' })
  await message('a', { at: '2026-09-12T08:05:00Z', parent: incoming })
  const [result] = await read()
  assert.equal(result.state, 'waiting')
  assert.equal(result.responseDetectedAt, null)
  assert.equal(result.lastBardoMessageAt, '2026-09-12T08:05:00.000Z')
  assert.equal(result.events.length, 1)
})

test('la revisión posterior al cambio de primavera usa el horario de verano', async () => {
  await exchange('spring', '2027-03-26T10:00:00Z')
  const [result] = await read({ now: '2027-03-27T12:00:00Z' })
  assert.equal(result.nextFollowUpAt, '2027-04-05T08:00:00.000Z')
})
