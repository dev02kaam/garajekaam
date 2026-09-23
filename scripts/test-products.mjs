import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import express from 'express'
import pg from 'pg'
import sharp from 'sharp'
import { productRouter } from '../server/product-routes.mjs'
import { createCampaignImageStore } from '../server/campaign-images.mjs'
import { resolveProduct, productCatalog } from '../shared/products.mjs'
import { launchCampaign } from '../server/n8n-client.mjs'

const url = process.env.PRODUCTS_TEST_DATABASE_URL
if (!url || new URL(url).pathname !== '/kaam_products_test' || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) {
  throw new Error('Use the disposable local kaam_products_test database')
}
const pool = new pg.Pool({ connectionString: url })
const schema = 'products_test_' + randomUUID().replaceAll('-', '')
const ficharia = createCampaignImageStore(pool, schema)
const deca = createCampaignImageStore(pool, 'garaje_deca', 'deca-campana-')
let server, origin, bytes, first, second, adapterCalls = 0
const auth = (req, res, next) => req.get('X-Test-Session') === 'operator' ? next() : res.status(401).json({ code: 'SESSION_EXPIRED' })
const csrf = (req, res, next) => req.get('X-CSRF-Token') === 'test' ? next() : res.status(403).json({ code: 'INVALID_CSRF' })
const file = buffer => ({ buffer, originalname: 'prueba.png', mimetype: 'image/png' })
before(async () => {
  await pool.query(await readFile(new URL('../migrations/001_deca_campaign_email_assets.sql', import.meta.url), 'utf8'))
  await pool.query('TRUNCATE garaje_deca.campaign_email_assets')
  await pool.query(`CREATE SCHEMA "${schema}"; CREATE TABLE "${schema}".campaign_email_assets (LIKE public.campaign_email_assets INCLUDING ALL)`)
  bytes = await sharp({ create: { width: 240, height: 160, channels: 3, background: '#458060' } }).png().toBuffer()
  const adapter = express.Router()
  adapter.get('/jobs', (_req,res) => { adapterCalls++; res.json({ jobs: [{id:'historical-ficharia'}] }) })
  const app = express()
  app.use(express.json())
  app.use('/api/products', productRouter({ pool, fichariaRouter: adapter, authenticate: auth, protectCsrf: csrf }))
  app.use((error,_req,res,_next) => res.status(500).json({message:error.message}))
  server = app.listen(0,'127.0.0.1')
  await new Promise(resolve => server.once('listening',resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve))
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
  await pool.query('TRUNCATE garaje_deca.campaign_email_assets')
  await pool.end()
})
const call = (path, init = {}) => fetch(origin + '/api/products' + path, { ...init, headers: { 'X-Test-Session':'operator', ...init.headers } })

test('catálogo autenticado y capacidades acordadas', async () => {
  assert.equal((await fetch(origin+'/api/products')).status,401)
  assert.deepEqual((await (await call('')).json()).products, Object.values(productCatalog))
  assert.throws(() => resolveProduct('__proto__'), {status:404})
})
test('DECA y desconocidos nunca alcanzan el adaptador Ficharia', async () => {
  assert.equal((await call('/ficharia/workflows/jobs')).status,200)
  assert.equal(adapterCalls,1)
  for(const name of ['jobs','campaigns','conversations','followups','creatives']) {
    const res=await call('/deca/workflows/'+name)
    assert.equal(res.status,200)
    const data=await res.json()
    assert.equal(data.product_id,'deca'); assert.equal(data.configured,false)
    assert.equal(JSON.stringify(data).includes('historical-ficharia'),false)
  }
  for(const name of ['campaigns/launch','creative/generate','creative/review-request']) {
    const res=await call('/deca/workflows/'+name,{method:'POST'})
    assert.equal(res.status,503); assert.equal((await res.json()).code,'PRODUCT_NOT_READY')
  }
  assert.equal((await call('/unknown/workflows/jobs')).status,404)
  assert.equal((await call('/deca/workflows/jobs', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{"product_id":"ficharia"}'})).status,400)
  assert.equal(adapterCalls,1)
  await assert.rejects(launchCampaign({productId:'deca'}),{code:'PRODUCT_NOT_READY'})
})
test('duplicados, claves, selección y archivos están aislados', async () => {
  first = (await ficharia.upload(file(bytes))).image
  second = (await deca.upload(file(bytes))).image
  assert.equal(first.sha256,second.sha256)
  assert.equal(first.id,'ficharia-campana-01'); assert.equal(second.id,'deca-campana-01')
  assert.equal((await deca.upload(file(bytes))).duplicate,true)
  const activated = (await deca.setActive(second.id,true,second.revision)).image
  assert.equal(activated.active,true)
  assert.equal((await ficharia.list()).images[0].active,false)
  assert.equal((await pool.query('SELECT row_version FROM garaje_deca.campaign_email_assets')).rows[0].row_version,'2')
  await assert.rejects(deca.content(first.id),{code:'IMAGE_NOT_FOUND'})
  await assert.rejects(ficharia.content(second.id),{code:'IMAGE_NOT_FOUND'})
  await assert.rejects(deca.setActive(first.id,true,first.revision),{code:'IMAGE_NOT_FOUND'})
  assert.deepEqual((await deca.content(second.id)).bytes,bytes)
  assert.equal((await deca.content(second.id,true)).mimeType,'image/webp')
  assert.equal((await call('/deca/workflows/campaign-images/'+first.id+'/file')).status,400)
  const content=await call('/deca/workflows/campaign-images/'+second.id+'/file?download=1')
  assert.deepEqual(Buffer.from(await content.arrayBuffer()),bytes)
})
test('sustitución y revisión obsoleta no afectan Ficharia; CSRF protege mutaciones', async () => {
  const current=(await deca.list()).images[0]
  await assert.rejects(deca.setActive(current.id,false,second.revision),{code:'IMAGE_CHANGED'})
  const replacement=await sharp({create:{width:240,height:160,channels:3,background:'#ce6540'}}).png().toBuffer()
  const updated=(await deca.replace(current.id,file(replacement),current.revision)).image
  assert.equal(updated.active,true);assert.equal(updated.id,current.id)
  assert.notEqual(updated.sha256,first.sha256)
  assert.deepEqual((await ficharia.content(first.id)).bytes,bytes)
  assert.deepEqual((await deca.content(updated.id)).bytes,replacement)
  const response=await call('/deca/workflows/campaign-images/'+updated.id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({active:false,revision:updated.revision})})
  assert.equal(response.status,403)
})
test('biblioteca ausente no recurre a otra biblioteca', async () => {
  assert.deepEqual(await createCampaignImageStore(pool,'absent_deca','deca-campana-').list(),{available:false,images:[]})
})
