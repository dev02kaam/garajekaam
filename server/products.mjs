import { productCatalog, resolveProduct, ProductError } from '../shared/products.mjs'
export { productCatalog, resolveProduct, ProductError }

export function productConfiguration(productId, fichariaSchema = 'public') {
  const product = resolveProduct(productId)
  return { ...product, schema: product.id === 'ficharia' ? fichariaSchema : 'garaje_deca',
    imagePrefix: product.id + '-campana-', plannedMailbox: product.id === 'deca' ? 'deca@kaam.es' : null }
}
