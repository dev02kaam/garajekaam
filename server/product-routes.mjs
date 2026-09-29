import express from 'express'
import { dekaamWorkflowRouter } from './dekaam-routes.mjs'
import { productCatalog, resolveProduct, ProductError, productConfiguration } from './products.mjs'
import { createCampaignImageStore } from './campaign-images.mjs'
import { campaignImageRouter } from './campaign-image-routes.mjs'

export function productRouter({ pool, fichariaRouter, authenticate, protectCsrf }) {
  const router = express.Router()
  router.use(authenticate)
  router.get('/', (_req, res) => res.json({ products: Object.values(productCatalog) }))
  const config = productConfiguration('deca')
  const decaImages = campaignImageRouter({
    store: createCampaignImageStore(pool, config.schema, config.imagePrefix),
    prefix: config.imagePrefix, authenticate, protectCsrf,
  })
  router.use('/:productId/workflows', (req, res, next) => {
    try {
      const product = resolveProduct(req.params.productId, undefined, req.body?.product_id)
      req.product = product
      if (product.id === 'ficharia') return fichariaRouter(req, res, error => error ? next(error)
        : res.status(404).json({ product_id: 'ficharia', code: 'NOT_FOUND', message: 'Recurso no encontrado.' }))
      next()
    } catch (error) { next(error) }
  })
  router.use('/deca/workflows', dekaamWorkflowRouter({pool,authenticate,protectCsrf}))
  router.use('/deca/workflows/campaign-images', decaImages)
  router.use((error, _req, res, next) => {
    if (!(error instanceof ProductError)) return next(error)
    return res.status(error.status).json({ code: error.code, product_id: error.product_id, message: error.message })
  })
  return router
}
