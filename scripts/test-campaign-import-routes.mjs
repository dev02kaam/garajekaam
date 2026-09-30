import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { campaignImportRouter } from '../server/campaign-import-routes.mjs'

test('large uploads use disk, preserve product/CSRF, start once and remove temporary files', async () => {
  const app = express(), starts = [], ingested = []
  const authenticate = (req, res, next) => req.get('X-Test-Session') === 'yes' ? next() : res.sendStatus(401)
  const protectCsrf = (req, res, next) => req.get('X-CSRF-Token') === 'test' ? next() : res.sendStatus(403)
  for (const productId of ['ficharia', 'deca']) app.use('/' + productId, campaignImportRouter({ pool: {}, productId, authenticate, protectCsrf, configured: () => true,
    ingest: async input => {
      assert.equal(input.file.buffer, undefined)
      assert.equal((await stat(input.file.path)).size, input.file.size)
      ingested.push(input)
      return { accepted: true, campaign_id: input.campaign_id, product_id: input.productId, accepted_contacts: 12000, recovery_token: randomUUID() }
    }, start: async input => { starts.push(input); if (input.productId === 'deca') throw new Error('simulated network failure') },
  }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${server.address().port}`
  const headers = { 'X-Test-Session': 'yes', 'X-CSRF-Token': 'test' }
  const form = (productId, large = false) => {
    const data = new FormData()
    data.append('csv', new Blob(['Email;Empresa\na@example.test;Empresa\n', large ? ' '.repeat(11 * 1024 * 1024) : ''], { type: 'text/csv' }), 'large.csv')
    data.append('prompt', 'Todas las empresas durante la jornada')
    data.append('source', 'garaje-kaam'); data.append('validContacts', '12000'); data.append('campaign_id', randomUUID())
    if (productId) data.append('product_id', productId)
    return data
  }
  try {
    assert.equal((await fetch(url + '/ficharia/campaigns/import', { method: 'POST' })).status, 401)
    assert.equal((await fetch(url + '/ficharia/campaigns/import', { method: 'POST', headers: { 'X-Test-Session': 'yes' } })).status, 403)
    assert.equal((await fetch(url + '/deca/campaigns/import', { method: 'POST', headers, body: form('ficharia') })).status, 400)
    assert.equal(ingested.length, 0)
    for (const productId of ['ficharia', 'deca']) {
      const response = await fetch(url + '/' + productId + '/campaigns/import', { method: 'POST', headers, body: form(productId, true) })
      assert.equal(response.status, 202, response.status === 202 ? '' : await response.text())
      const result = await response.json()
      assert.equal(result.product_id, productId)
      assert.equal(result.recovery_token, undefined)
      assert.equal(result.startup_pending, productId === 'deca')
    }
    assert.equal(starts.length, 2)
    assert.equal(ingested.length, 2)
    assert(ingested.every(input => input.file.size > 10 * 1024 * 1024))
  } finally { await new Promise(resolve => server.close(resolve)) }
  // Cleanup runs in the route's finally after the response has been written.
  for (const input of ingested) {
    let exists = true
    for (let attempt = 0; exists && attempt < 20; attempt++) {
      exists = await stat(input.file.path).then(() => true, () => false)
      if (exists) await new Promise(resolve => setTimeout(resolve, 25))
    }
    assert.equal(exists, false)
  }
})
