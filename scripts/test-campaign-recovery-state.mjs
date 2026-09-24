import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
const url = process.env.DATABASE_URL
if (!url || !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) || new URL(url).pathname !== '/kaam_bulk_test') throw Error('Disposable local kaam_bulk_test required')
const { pool } = await import('../server/database.mjs')
const { getCampaigns, getCampaignContacts } = await import('../server/workflow-data.mjs')
let id
try {
  id = (await pool.query('SELECT ficharia_campaign_enqueue($1::jsonb) AS result', [JSON.stringify({
    ingest_key: randomUUID(), workflow_execution_id: 'dashboard-test', source_filename: 'test.csv', prompt: 'Dashboard recovery test without sends',
    contacts: Array.from({ length: 3 }, (_, i) => ({ email: `dash${i}@example.test`, data: { company: 'Local fixture' } })), config: {},
  })])).rows[0].result.campaign_id
  const contacts = (await pool.query('SELECT contact_id FROM outbound_campaign_contacts WHERE campaign_id=$1 ORDER BY contact_id', [id])).rows
  await pool.query("UPDATE outbound_campaigns SET status='sending' WHERE campaign_id=$1", [id])
  await pool.query("UPDATE outbound_campaign_contacts SET status='sending',scheduled_at=now(),lease_owner='fixture',lease_expires_at=now()-interval '1 minute' WHERE contact_id=$1", [contacts[0].contact_id])
  await pool.query("UPDATE outbound_campaign_contacts SET status='sent',scheduled_at=now(),sent_at=now()-interval '20 minutes' WHERE contact_id=$1", [contacts[1].contact_id])
  let campaign = (await getCampaigns(200)).campaigns.find(x => x.id === id)
  assert.equal(campaign.deliveryHealth.needsRecovery, true)
  assert.equal(campaign.deliveryHealth.expiredReservations, 1)
  assert(campaign.deliveryHealth.lastSentAt)
  assert.equal(campaign.deliveryIssues.length, 1)
  assert.match(campaign.deliveryIssues[0].reason, /recuperación/)
  const list = filter => getCampaignContacts({ campaignId: id, limit: 50, offset: 0, query: '', status: filter })
  assert.equal((await list('issues')).total, 1)
  assert.equal((await list('issues')).contacts[0].recoveryPending, true)
  assert.equal((await list('pending')).total, 1)
  await pool.query("UPDATE outbound_campaign_contacts SET status='scheduled',lease_owner=NULL,lease_expires_at=NULL WHERE contact_id=$1", [contacts[0].contact_id])
  campaign = (await getCampaigns(200)).campaigns.find(x => x.id === id)
  assert.equal(campaign.deliveryHealth.needsRecovery, false)
  assert.equal(campaign.deliveryIssues.length, 0)
  assert.equal((await list('issues')).total, 0)
  assert.equal((await list('pending')).total, 2)
  await pool.query("UPDATE outbound_campaign_contacts SET status='sending',lease_owner='fixture',lease_expires_at=now()+interval '10 minutes' WHERE contact_id=$1", [contacts[0].contact_id])
  await pool.query("INSERT INTO kaam_mailboxes(mailbox) VALUES('dashboard-test@example.test') ON CONFLICT DO NOTHING")
  await pool.query("INSERT INTO kaam_mail_attempts(source_kind,source_id,mailbox,execution_id,started_at) VALUES('campaign',$1,'dashboard-test@example.test','fixture',now()-interval '3 minutes')", [contacts[0].contact_id])
  campaign = (await getCampaigns(200)).campaigns.find(x => x.id === id)
  assert.equal(campaign.deliveryHealth.needsRecovery, false)
  assert.equal(campaign.deliveryHealth.transportDelayed, true, 'Show stalled transport before the 15-minute lease expires')
  assert.equal(campaign.deliveryHealth.stalledTransports, 1)
  assert(campaign.deliveryHealth.oldestTransportAt)
  await pool.query("UPDATE kaam_mail_attempts SET outcome='sent',finished_at=now() WHERE source_id=$1", [contacts[0].contact_id])
  campaign = (await getCampaigns(200)).campaigns.find(x => x.id === id)
  assert.equal(campaign.deliveryHealth.transportDelayed, false)
  await pool.query("DELETE FROM kaam_mail_attempts WHERE mailbox='dashboard-test@example.test'")
  await pool.query("DELETE FROM kaam_mailboxes WHERE mailbox='dashboard-test@example.test'")
  console.log('PASS: stale sends are visible as recoverable issues; filters and last-send time agree; recovered contacts return to pending without stale alerts.')
} finally {
  if (id) await pool.query('DELETE FROM outbound_campaigns WHERE campaign_id=$1', [id])
  await pool.end()
}
