import express from 'express'
import multer from 'multer'
import {z} from 'zod'
import {createWorkflowData} from './workflow-data-store.mjs'
import {productConfiguration,resolveProduct} from './products.mjs'
import {campaignWebhookConfigured,launchCampaign} from './n8n-client.mjs'
import {campaignImportRouter} from './campaign-import-routes.mjs'

export function dekaamWorkflowRouter({pool,authenticate,protectCsrf}) {
 const router=express.Router(), config=productConfiguration('deca')
 const data=createWorkflowData({pool,schema:config.schema,productId:'deca'})
 router.use(authenticate)
 router.use(campaignImportRouter({pool,productId:'deca',authenticate,protectCsrf}))
 router.use((_req,res,next)=>{const json=res.json.bind(res);res.json=body=>json({...body,product_id:'deca'});res.set('Cache-Control','private, no-store');next()})
 const parse=(schema,value,res)=>{const r=schema.safeParse(value);if(r.success)return r.data;res.status(400).json({code:'INVALID_INPUT',message:'Revisa los datos de la solicitud.'});return null}
 const limitSchema=z.object({limit:z.coerce.number().int().min(1).max(200).default(100)}).strict()
 for(const [path,loader] of Object.entries({jobs:data.getJobs,campaigns:data.getCampaigns,conversations:data.getConversations}))router.get('/'+path,async(req,res)=>{const p=parse(limitSchema,req.query,res);if(p)res.json(await loader(p.limit))})
 router.get('/campaigns/:campaignId/contacts',async(req,res)=>{
  const id=parse(z.string().uuid(),req.params.campaignId,res);if(!id)return
  const p=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(2000000).default(0),query:z.string().trim().max(160).default(''),status:z.enum(['all','sent','pending','issues','not-selected']).default('all')}).strict(),req.query,res)
  if(p)res.json(await data.getCampaignContacts({campaignId:id,...p}))
 })
 router.get('/optouts',async(req,res)=>{
  const p=parse(z.object({limit:z.coerce.number().int().min(1).max(100).default(50),offset:z.coerce.number().int().min(0).max(100000).default(0),query:z.string().trim().max(200).default('')}).strict(),req.query,res)
  if(p)res.json(await data.getOptouts(p))
 })
 router.get('/conversations/emails/:emailId',async(req,res)=>{
  const id=parse(z.string().uuid(),req.params.emailId,res);if(!id)return
  const r=await data.getConversationEmail(id)
  if(r.available&&!r.email)return res.status(404).json({code:'EMAIL_NOT_FOUND',message:'No se encontró el correo solicitado.'})
  res.json(r)
 })
 router.get('/followups',(_req,res)=>res.json({available:false,conversations:[]}))
 router.get('/creatives',(_req,res)=>res.json({available:false,assets:[]}))
 router.get('/config',(_req,res)=>res.json({campaignWebhookConfigured:campaignWebhookConfigured('deca'),sender:'deca@kaam.es'}))
 const upload=multer({storage:multer.memoryStorage(),limits:{files:1,fileSize:10*1024*1024,fields:5,fieldSize:8192},fileFilter:(_req,file,cb)=>{
  const valid=file.originalname.toLowerCase().endsWith('.csv')&&['text/csv','application/csv','application/vnd.ms-excel','text/plain','application/octet-stream'].includes(file.mimetype)
  cb(valid?null:new multer.MulterError('LIMIT_UNEXPECTED_FILE','csv'),valid)
 }})
 router.post('/campaigns/launch',protectCsrf,upload.single('csv'),async(req,res,next)=>{
  try {
   resolveProduct('deca','campaigns',req.body?.product_id)
   const p=parse(z.object({prompt:z.string().trim().min(1).max(1200),source:z.literal('garaje-kaam'),validContacts:z.coerce.number().int().min(1).max(2000000),campaign_id:z.string().uuid().optional(),product_id:z.literal('deca').optional()}).strict(),req.body,res)
   if(!p)return
   if(!req.file)return res.status(400).json({code:'CSV_REQUIRED',message:'Adjunta un archivo CSV.'})
   const sample=req.file.buffer.subarray(0,65536).toString('utf8')
   if(sample.includes('\0')||! /\r?\n/.test(sample))return res.status(400).json({code:'INVALID_CSV',message:'El archivo no parece un CSV válido.'})
   res.status(202).json(await launchCampaign({file:req.file,...p,productId:'deca'}))
  } catch(error) {
   if(error.code==='N8N_NOT_CONFIGURED')return res.status(503).json({code:error.code,message:error.message})
   if(error.name==='TimeoutError')return res.status(504).json({code:'N8N_TIMEOUT',message:'Comprueba el historial antes de volver a enviar la campaña.'})
   if(error.code==='N8N_REJECTED')return res.status([400,409,422,429].includes(error.status)?error.status:502).json({code:error.code,message:error.message})
   if(error.code==='PRODUCT_ID_MISMATCH')return res.status(error.status||400).json({code:error.code,message:error.message})
   if(error instanceof TypeError)return res.status(502).json({code:'N8N_UNREACHABLE',message:'No se pudo conectar con n8n.'})
   next(error)
  }
 })
 router.post(['/creative/generate','/creative/review-request'],(_req,res)=>res.status(503).json({code:'PRODUCT_NOT_READY',message:'Esta función todavía no está disponible para DEKAAM.'}))
 return router
}
