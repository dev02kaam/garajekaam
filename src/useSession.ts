import { useCallback, useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { ApiError, authApi, invalidateRequests, SESSION_FAILURE_EVENT, type LoginResult, type SessionState, type SessionTiming } from './auth'

type AuthPhase = 'checking' | 'anonymous' | 'authenticated' | 'unavailable'
const LOGOUT_PENDING_KEY = 'kaam-logout-pending'
const EXPIRED_MESSAGE = 'Tu sesión ha caducado. Vuelve a identificarte.'
const OFFLINE_MESSAGE = 'Sin conexión con el servidor. El acceso está bloqueado hasta verificar la sesión.'

export function useSession(onLock: () => void) {
  const [authPhase, setAuthPhase] = useState<AuthPhase>('checking')
  const [sessionState, setSessionState] = useState<SessionState | null>(null)
  const [authError, setAuthError] = useState('')
  const [sessionMessage, setSessionMessage] = useState('')
  const current = useRef<SessionState | null>(null)
  const revision = useRef(0)
  const deadline = useRef(0)
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pendingLogout = useRef(false)
  const busy = useRef<number | null>(null)
  const channel = useRef<BroadcastChannel | null>(null)
  const lastActivitySent = useRef(Date.now())
  const activityPending = useRef(false)
  const recheck = useRef<() => Promise<void>>(async () => {})

  const rememberLogout = useCallback((pending: boolean) => {
    pendingLogout.current = pending
    try {
      if (pending) localStorage.setItem(LOGOUT_PENDING_KEY, 'true')
      else localStorage.removeItem(LOGOUT_PENDING_KEY)
    } catch { /* Storage can be disabled; retain the intent in this tab. */ }
    if (!pending) channel.current?.postMessage('logout-complete')
  }, [])

  const lock = useCallback((message = '', phase: AuthPhase = 'unavailable') => {
    revision.current += 1
    invalidateRequests()
    clearTimeout(expiryTimer.current)
    current.current = null
    activityPending.current = false
    setSessionState(null)
    setAuthError(message)
    setAuthPhase(phase)
    onLock()
  }, [onLock])

  const expireSession = useCallback(() => {
    setSessionMessage(EXPIRED_MESSAGE)
    lock('', 'checking')
    // Another tab may have renewed genuine activity; the server decides expiry.
    void recheck.current()
  }, [lock])

  const acceptTiming = useCallback((timing: SessionTiming) => {
    if (!timing || !Number.isFinite(timing.expiresAt) || !Number.isFinite(timing.serverNow)) {
      throw new Error('No se pudo verificar la caducidad de la sesión.')
    }
    // Use the server's remaining lifetime; client and server clocks may differ.
    const remaining = timing.expiresAt - timing.serverNow
    if (remaining <= 0) throw new Error(EXPIRED_MESSAGE)
    deadline.current = Date.now() + remaining
    clearTimeout(expiryTimer.current)
    expiryTimer.current = setTimeout(expireSession, Math.max(0, deadline.current - Date.now()))
  }, [expireSession])

  const acceptSession = useCallback((state: SessionState) => {
    if (state.authenticated) {
      if (!state.user || !state.timing) throw new Error('No se pudo verificar la sesión.')
      acceptTiming(state.timing)
      setSessionMessage('')
    } else clearTimeout(expiryTimer.current)
    current.current = state
    setSessionState(state)
    setAuthError('')
    setAuthPhase(state.authenticated ? 'authenticated' : 'anonymous')
  }, [acceptTiming])

  const refreshSession = useCallback(async () => {
    const version = revision.current
    if (busy.current === version) return
    busy.current = version
    try {
      let state = await authApi.session()
      if (version !== revision.current) return
      try { pendingLogout.current ||= localStorage.getItem(LOGOUT_PENDING_KEY) === 'true' } catch { /* Optional storage. */ }
      if (pendingLogout.current) {
        if (state.authenticated) {
          await authApi.logout(state.csrfToken)
          if (version !== revision.current) return
        }
        rememberLogout(false)
        state = await authApi.session()
        if (version !== revision.current) return
      }
      if (current.current?.authenticated && !state.authenticated) setSessionMessage(EXPIRED_MESSAGE)
      if (!state.authenticated) onLock()
      acceptSession(state)
    } catch (caught) {
      if (version === revision.current) lock(caught instanceof Error ? caught.message : OFFLINE_MESSAGE)
    } finally { if (busy.current === version) busy.current = null }
  }, [acceptSession, lock, onLock, rememberLogout])

  const completeLogin = useCallback((result: LoginResult) => {
    if (!navigator.onLine || pendingLogout.current) return
    try {
      revision.current += 1
      invalidateRequests()
      lastActivitySent.current = Date.now()
      setSessionMessage('')
      acceptSession({ authenticated: true, ...result, setupRequired: false })
    } catch (caught) { lock(caught instanceof Error ? caught.message : OFFLINE_MESSAGE) }
  }, [acceptSession, lock])

  const logout = useCallback(async () => {
    rememberLogout(true)
    setSessionMessage('')
    lock('', 'checking')
    channel.current?.postMessage('logout')
    await refreshSession()
  }, [lock, refreshSession, rememberLogout])

  useEffect(() => {
    recheck.current = refreshSession
    try { localStorage.removeItem('garaje-kaam-prospecting-prompts') } catch { /* Legacy private history is no longer read. */ }
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('kaam-session')
      channel.current.onmessage = (event) => {
        if (event.data === 'logout-complete') pendingLogout.current = false
        if (event.data === 'logout') {
          pendingLogout.current = true
          lock('La sesión se ha cerrado en otra pestaña.')
        }
      }
    }
    const onFailure = (event: Event) => {
      const error = (event as CustomEvent<ApiError>).detail
      lock(error.status === 401 || error.code === 'INVALID_CSRF' ? EXPIRED_MESSAGE : OFFLINE_MESSAGE)
    }
    const onOffline = () => lock(OFFLINE_MESSAGE)
    const onResume = () => {
      if (document.visibilityState !== 'visible') return
      flushSync(() => lock('', 'checking'))
      void refreshSession()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        // Prevent a private DOM snapshot from remaining in a suspended/restored page.
        flushSync(() => lock('', 'checking'))
      } else onResume()
    }
    const onFocus = () => {
      // A file picker also returns focus: keep its draft while a still-valid session is checked.
      if (current.current?.authenticated && Date.now() < deadline.current) void refreshSession()
      else onResume()
    }
    const onPageHide = () => flushSync(() => lock('', 'checking'))
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) onResume() }
    const onStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_PENDING_KEY && event.newValue === null) pendingLogout.current = false
      if (event.key === LOGOUT_PENDING_KEY && event.newValue === 'true') {
        pendingLogout.current = true
        lock('La sesión se ha cerrado en otra pestaña.')
      }
    }
    const sendActivity = async () => {
      const state = current.current
      if (!state?.authenticated || !activityPending.current || busy.current === revision.current || Date.now() - lastActivitySent.current < 60_000) return
      if (Date.now() >= deadline.current) { expireSession(); return }
      const version = revision.current
      busy.current = version
      activityPending.current = false
      lastActivitySent.current = Date.now()
      try {
        const result = await authApi.activity(state.csrfToken)
        if (version === revision.current && current.current?.authenticated) {
          acceptTiming(result.timing)
          current.current = { ...current.current, timing: result.timing }
          setSessionState(current.current)
        }
      } catch (caught) {
        if (version === revision.current) lock(caught instanceof Error ? caught.message : OFFLINE_MESSAGE)
      }
      finally { if (busy.current === version) busy.current = null }
    }
    const onActivity = (event: Event) => {
      if (!event.isTrusted || document.visibilityState !== 'visible' || !current.current?.authenticated) return
      if (Date.now() >= deadline.current) { expireSession(); return }
      activityPending.current = true
      void sendActivity()
    }
    window.addEventListener(SESSION_FAILURE_EVENT, onFailure)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onResume)
    window.addEventListener('focus', onFocus)
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibility)
    const activityEvents = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    activityEvents.forEach((name) => window.addEventListener(name, onActivity, { passive: true, capture: true }))
    const interval = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void sendActivity()
      if (busy.current !== revision.current) void refreshSession()
    }, 30_000)
    void refreshSession()
    return () => {
      revision.current += 1
      invalidateRequests()
      clearTimeout(expiryTimer.current)
      window.clearInterval(interval)
      channel.current?.close()
      window.removeEventListener(SESSION_FAILURE_EVENT, onFailure)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onResume)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibility)
      activityEvents.forEach((name) => window.removeEventListener(name, onActivity, true))
    }
  }, [acceptTiming, expireSession, lock, refreshSession])

  return { authPhase, sessionState, setSessionState, authError, sessionMessage, setSessionMessage, refreshSession, completeLogin, logout, expireSession }
}
