// Public contract, maintained only in code. No credentials or commercial claims.
export const PRODUCT_CONTRACT_VERSION = 1
export const productCatalog = Object.freeze({
  ficharia: Object.freeze({
    id: 'ficharia', name: 'Ficharia', description: 'Control horario y gestión de fichajes del equipo.', status: 'active',
    links: Object.freeze({ video_demo: 'https://youtu.be/WpOQs9Bdn94', personalized_demo: 'https://youtu.be/WpOQs9Bdn94' }),
    capabilities: Object.freeze({ campaign_drafts: true, creative_drafts: true, image_library: true,
      campaigns: true, replies: true, followups: true, creative_generate: true, creative_review: true }),
  }),
  deca: Object.freeze({
    id: 'deca', name: 'DECA · Una app de Kaam', description: 'Bajo construcción. Pendiente de información para habilitar sus automatizaciones.', status: 'preparing',
    capabilities: Object.freeze({ campaign_drafts: true, creative_drafts: true, image_library: true,
      campaigns: false, replies: false, followups: false, creative_generate: false, creative_review: false }),
  }),
})

export class ProductError extends Error {
  constructor(status, code, productId, message) {
    super(message)
    this.status = status
    this.code = code
    this.product_id = typeof productId === 'string' ? productId.slice(0, 80) : null
  }
}
export function resolveProduct(productId, capability, bodyProductId) {
  if (bodyProductId !== undefined && bodyProductId !== productId) {
    throw new ProductError(400, 'PRODUCT_ID_MISMATCH', productId, 'El producto de la ruta y el cuerpo no coinciden.')
  }
  if (typeof productId !== 'string' || !Object.hasOwn(productCatalog, productId)) {
    throw new ProductError(404, 'PRODUCT_NOT_FOUND', productId, 'El producto no existe.')
  }
  const product = productCatalog[productId]
  if (capability && product.capabilities[capability] !== true) {
    throw new ProductError(503, 'PRODUCT_NOT_READY', productId, 'Bajo construcción.')
  }
  return product
}
