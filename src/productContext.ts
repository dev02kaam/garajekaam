import { createContext, useContext, useState, type Dispatch, type SetStateAction } from 'react'
import type { createWorkflowApi } from './workflowApi'

export type ProductSummary = {
  id: string
  name: string
  description: string
  status: 'active' | 'preparing'
  links?: { video_demo: string; personalized_demo: string }
  capabilities: Record<'campaign_drafts' | 'creative_drafts' | 'image_library' | 'campaigns' | 'replies' | 'followups' | 'creative_generate' | 'creative_review', boolean>
}
export type ProductContextValue = {
  products: ProductSummary[]
  product: ProductSummary
  selectProduct: (id: string) => void
  busy: boolean
  signal: AbortSignal
  api: ReturnType<typeof createWorkflowApi>
  memory: Map<string, unknown>
}
export const ProductContext = createContext<ProductContextValue | null>(null)
export function useProducts() {
  const context = useContext(ProductContext)
  if (!context) throw new Error('Product context is required')
  return context
}
export function useProductMemory<T>(key: string, initial: T, shared = false): [T, Dispatch<SetStateAction<T>>] {
  const { product, memory } = useProducts()
  const memoryKey = `${shared ? 'navigation' : product.id}:${key}`
  const [value, setValue] = useState<T>(() => memory.has(memoryKey) ? memory.get(memoryKey) as T : initial)
  const update: Dispatch<SetStateAction<T>> = next => {
    setValue(current => {
      const resolved = typeof next === 'function' ? (next as (value: T) => T)(current) : next
      memory.set(memoryKey, resolved)
      return resolved
    })
  }
  return [value, update]
}
