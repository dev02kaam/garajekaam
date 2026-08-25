export type UserRole = 'admin' | 'operator'
export type UserStatus = 'active' | 'disabled'

export type SessionUser = {
  id: string
  email: string
  displayName: string
  role: UserRole
  status: UserStatus
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export type SessionState = {
  authenticated: boolean
  user: SessionUser | null
  csrfToken: string
  setupRequired: boolean
}

export type UserInput = {
  displayName: string
  email: string
  role: UserRole
  password: string
}

export type UserUpdateInput = UserInput & { status: UserStatus }

export class ApiError extends Error {
  status: number
  code: string
  fields: Record<string, string[] | undefined>

  constructor(status: number, payload?: { code?: string; message?: string; fields?: Record<string, string[] | undefined> }) {
    super(payload?.message || 'No se pudo completar la operación.')
    this.name = 'ApiError'
    this.status = status
    this.code = payload?.code || 'UNKNOWN_ERROR'
    this.fields = payload?.fields || {}
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body) headers.set('Content-Type', 'application/json')

  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'same-origin' })
  } catch {
    throw new ApiError(0, { code: 'NETWORK_ERROR', message: 'No se puede conectar con el servidor de Garaje Kaam.' })
  }

  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(response.status, payload)
  return payload as T
}

function csrfHeaders(csrfToken: string) {
  return { 'X-CSRF-Token': csrfToken }
}

export const authApi = {
  session: () => request<SessionState>('/api/auth/session'),
  login: (email: string, password: string, csrfToken: string) => request<{ user: SessionUser; csrfToken: string }>('/api/auth/login', {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ email, password }),
  }),
  logout: (csrfToken: string) => request<void>('/api/auth/logout', {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
  }),
  listUsers: () => request<{ users: SessionUser[] }>('/api/users'),
  createUser: (input: UserInput, csrfToken: string) => request<{ user: SessionUser }>('/api/users', {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify(input),
  }),
  updateUser: (id: string, input: UserUpdateInput, csrfToken: string) => request<{ user: SessionUser }>(`/api/users/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify(input),
  }),
  deleteUser: (id: string, csrfToken: string) => request<void>(`/api/users/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: csrfHeaders(csrfToken),
  }),
}

