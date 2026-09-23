import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { request } from '../auth'
import { ProductContext, useProducts, type ProductSummary } from '../productContext'
import { createWorkflowApi } from '../workflowApi'

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [scope, setScope] = useState(() => ({ id: 'ficharia', controller: new AbortController() }))
  const [busy, setBusy] = useState(false)
  const pending = useRef(0)
  const memory = useRef(new Map<string, unknown>())
  const mounted = useRef(false)
  useEffect(() => {
    const controller = new AbortController()
    request<{ products: ProductSummary[] }>('/api/products', { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setProducts(result.products); setError('') } })
      .catch(() => { if (!controller.signal.aborted) setError('No se pudo cargar el catálogo. Vuelve a intentarlo.') })
    return () => controller.abort()
  }, [attempt])
  useEffect(() => {
    const drafts = memory.current
    return () => { drafts.clear() }
  }, [])
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      // React development StrictMode replays effects with the same scope.
      queueMicrotask(() => { if (!mounted.current) scope.controller.abort() })
    }
  }, [scope])
  const beginMutation = useCallback(() => {
    pending.current += 1
    setBusy(true)
    return () => { pending.current -= 1; setBusy(pending.current > 0) }
  }, [])
  const api = useMemo(() => createWorkflowApi(scope.id, scope.controller.signal, beginMutation), [scope, beginMutation])
  const product = products.find(item => item.id === scope.id)
  if (!product) return <div className="session-loading" role="status">
    <p>{error || 'Cargando productos…'}</p>
    {error && <button type="button" onClick={() => setAttempt(value => value + 1)}>Volver a intentar</button>}
  </div>
  return <ProductContext.Provider value={{ products, product, busy, api, memory: memory.current, signal: scope.controller.signal,
    selectProduct: id => {
      if (pending.current || id === scope.id || !products.some(item => item.id === id)) return
      scope.controller.abort()
      setScope({ id, controller: new AbortController() })
    } }}>
    {children}
  </ProductContext.Provider>
}

export function ProductSelector() {
  const { products, product, selectProduct, busy } = useProducts()
  return <label className="product-selector">
    <span>Producto</span>
    <select aria-label="Producto" value={product.id} disabled={busy} onChange={event => selectProduct(event.target.value)}>
      {products.map(item => <option key={item.id} value={item.id}>{item.name}{item.status === 'preparing' ? ' · Bajo construcción' : ''}</option>)}
    </select>
    {busy && <small role="status">Guardando…</small>}
  </label>
}

export function ProductAvailability() {
  const { product } = useProducts()
  return product.status === 'preparing' ? <p className="product-availability" role="status">
    <strong>{product.name} · Bajo construcción</strong>
    <span>Pendiente de completar la información del producto. Puedes preparar borradores y organizar imágenes; los envíos y las automatizaciones están deshabilitados.</span>
  </p> : null
}
