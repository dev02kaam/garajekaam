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
  timing: SessionTiming | null
}

export type SessionTiming = { expiresAt: number; absoluteExpiresAt: number; idleTimeoutMs: number; serverNow: number }
export type LoginResult = { user: SessionUser; csrfToken: string; timing: SessionTiming }
export const SESSION_FAILURE_EVENT = 'kaam:session-failure'
let requestGeneration = 0

export function invalidateRequests() { requestGeneration += 1 }

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

export type ApiRequestInit = RequestInit & { timeoutMs?: number }

export async function request<T>(path: string, { timeoutMs = 10_000, ...init }: ApiRequestInit = {}): Promise<T> {
  const generation = requestGeneration
  const headers = new Headers(init.headers)
  headers.set('Accept', 'application/json')
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const timeout = AbortSignal.timeout(timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout

  try {
    const response = await fetch(path, { ...init, headers, signal, credentials: 'same-origin', cache: 'no-store' })
    const payload = response.status === 204 ? undefined : await response.json().catch(() => {
      throw new ApiError(0, { code: 'INVALID_RESPONSE', message: 'El servidor no ha devuelto una respuesta válida.' })
    })
    if (generation !== requestGeneration) throw new ApiError(0, { code: 'SESSION_CHANGED' })
    if (!response.ok) throw new ApiError(response.status, payload)
    return payload as T
  } catch (caught) {
    if (init.signal?.aborted || generation !== requestGeneration) throw caught
    const error = timeout.aborted ? new ApiError(0, {
      code: 'REQUEST_TIMEOUT', message: 'El servidor ha tardado demasiado en responder.',
    }) : caught instanceof ApiError ? caught : new ApiError(0, {
      code: 'NETWORK_ERROR', message: 'No se pudo conectar con el servidor.',
    })
    // An operation failure does not invalidate authentication. Session checks and
    // browser offline events still lock private views through useSession.
    if ((error.status === 401 && error.code !== 'INVALID_CREDENTIALS') || error.code === 'INVALID_CSRF') {
      window.dispatchEvent(new CustomEvent(SESSION_FAILURE_EVENT, { detail: error }))
    }
    throw error
  }
}

function csrfHeaders(csrfToken: string) {
  return { 'X-CSRF-Token': csrfToken }
}

export const authApi = {
  session: () => request<SessionState>('/api/auth/session'),
  login: (email: string, password: string, csrfToken: string) => request<LoginResult>('/api/auth/login', {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    body: JSON.stringify({ email, password }),
  }),
  logout: (csrfToken: string) => request<void>('/api/auth/logout', {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
  }),
  activity: (csrfToken: string) => request<{ timing: SessionTiming }>('/api/auth/activity', {
    method: 'POST', headers: csrfHeaders(csrfToken),
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
