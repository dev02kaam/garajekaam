import assert from 'node:assert/strict'
import {test} from 'node:test'
import express from 'express'
import pg from 'pg'
import {createWorkflowData} from '../server/workflow-data-store.mjs'

test('product routes isolate data, sender selection, multipart validation and CSRF',async()=>{
 const url=process.env.BULK_TEST_DATABASE_URL
 assert.ok(url&&new URL(url).pathname==='/kaam_bulk_test'&&['127.0.0.1','localhost'].includes(new URL(url).hostname),'Local disposable database required')
 const pool=new pg.Pool({connectionString:url}), upstream=express(),calls=[]
 upstream.post(['/webhook/ficharia/campanas','/webhook/dekaam/campanas'],(req,res)=>{
  const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{const body=Buffer.concat(chunks).toString('utf8');calls.push({url:req.path,body});res.status(202).json({status:'accepted',product_id:req.path.includes('/dekaam/')?'deca':'ficharia'})})
 })
 const provider=upstream.listen(0,'127.0.0.1');await new Promise(r=>provider.once('listening',r))
 process.env.NODE_ENV='test';process.env.N8N_PROSPECTING_WEBHOOK_URL=`http://127.0.0.1:${provider.address().port}/webhook/ficharia/campanas`
 const {productRouter}=await import('../server/product-routes.mjs')
 const {launchCampaign}=await import('../server/n8n-client.mjs')
 const f=createWorkflowData({pool,schema:'public',productId:'ficharia'}),d=createWorkflowData({pool,schema:'garaje_deca',productId:'deca'})
 const adapter=express.Router();adapter.get('/campaigns',async(_req,res)=>res.json({...await f.getCampaigns(100),product_id:'ficharia'}))
 const authenticate=(req,res,next)=>req.get('X-Test-Session')==='operator'?next():res.status(401).end()
 const protectCsrf=(req,res,next)=>req.get('X-CSRF-Token')==='test'?next():res.status(403).end()
 const app=express();app.use(express.json());app.use('/api/products',productRouter({pool,fichariaRouter:adapter,authenticate,protectCsrf}));app.use((e,_req,res,_next)=>res.status(500).json({message:e.message}))
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base=`http://127.0.0.1:${server.address().port}/api/products`
 const call=(path,init={})=>fetch(base+path,{...init,headers:{'X-Test-Session':'operator',...init.headers}})
 try{
  assert.equal((await fetch(base)).status,401)
  const products=(await(await call('')).json()).products;assert.equal(products.find(p=>p.id==='deca').name,'DEKAAM')
  const [fc,dc]=await Promise.all(['ficharia','deca'].map(async id=>{const r=await call('/'+id+'/workflows/campaigns');assert.equal(r.status,200);return r.json()}));assert.equal(fc.product_id,'ficharia');assert.equal(dc.product_id,'deca');assert.equal(fc.campaigns.length,1);assert.equal(dc.campaigns.length,1);assert.notEqual(fc.campaigns[0].id,dc.campaigns[0].id)
  const cross=await call('/deca/workflows/campaigns/'+fc.campaigns[0].id+'/contacts');assert.equal(cross.status,200);assert.equal((await cross.json()).total,0)
  for(const path of ['jobs','optouts','conversations','followups','creatives','config','campaign-images']){const r=await call('/deca/workflows/'+path);assert.equal(r.status,200,path);assert.equal((await r.json()).product_id,'deca')}
  const form=(product='deca')=>{const v=new FormData();v.set('csv',new Blob(['email\nclient@example.test\n'],{type:'text/csv'}),'test.csv');v.set('prompt','Seleccionar todas');v.set('source','garaje-kaam');v.set('validContacts','1');v.set('product_id',product);return v}
  assert.equal((await call('/deca/workflows/campaigns/launch',{method:'POST',body:form()})).status,403)
  assert.equal((await call('/deca/workflows/campaigns/launch',{method:'POST',headers:{'X-CSRF-Token':'test'},body:form('ficharia')})).status,400);assert.equal(calls.length,0)
  const launched=await call('/deca/workflows/campaigns/launch',{method:'POST',headers:{'X-CSRF-Token':'test'},body:form()});assert.equal(launched.status,202,await launched.text());assert.equal(calls[0].url,'/webhook/dekaam/campanas');assert.match(calls[0].body,/name="product_id"\r\n\r\ndeca/)
  await launchCampaign({file:{buffer:Buffer.from('email\nclient@example.test\n'),originalname:'test.csv'},prompt:'Todas',source:'garaje-kaam',validContacts:1});assert.equal(calls[1].url,'/webhook/ficharia/campanas');assert.match(calls[1].body,/name="product_id"\r\n\r\nficharia/)
  assert.equal((await d.getOptouts()).total,0)
 }finally{await Promise.all([new Promise(r=>server.close(r)),new Promise(r=>provider.close(r))]);await pool.end()}
})
