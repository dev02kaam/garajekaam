import { ProductsProvider, ProductSelector } from './components/ProductsProvider'
import {
  AtSign,
  Eye,
  EyeOff,
  Gamepad2,
  History,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  MessageSquareReply,
  MoveHorizontal,
  Palette,
  Send,
  UserRoundCog,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import ArcadeModal from './components/ArcadeModal'
import DashboardModal, { type AgentId } from './components/DashboardModal'
import UserManagementModal from './components/UserManagementModal'
import { ApiError, authApi, type LoginResult } from './auth'
import { useSession } from './useSession'
import garagePoster from './assets/garage-integrated-five-jobs.png'

const INITIAL_EMAIL = 'alex.benito@kaam.es'

const agents: Array<{
  id: AgentId
  name: string
  action: string
}> = [
  { id: 'prospecto', name: 'El Visionario', action: 'Lanzar campaña' },
  { id: 'bardo', name: 'El Bardo', action: 'Responder' },
  { id: 'marketing', name: 'Marketing', action: 'Imágenes y promociones' },
  { id: 'bucle', name: 'Doc Bucle', action: 'Ver seguimiento' },
]

function GarageMark() {
  return (
    <div className="garage-mark" aria-label="Garaje Kaam">
      <span className="checkered-mark" aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
      <span><strong>GARAJE</strong> <em>KAAM</em></span>
    </div>
  )
}

function AgentStation({ agent, onOpen }: {
  agent: (typeof agents)[number]
  onOpen: (id: AgentId) => void
}) {
  return (
    <button
      className="agent-station"
      data-agent={agent.id}
      type="button"
      onClick={() => onOpen(agent.id)}
      aria-label={`Abrir ${agent.name}: ${agent.action}`}
    >
      <span className="station-reveal">
        <strong>{agent.name}</strong>
        <small>{agent.action}</small>
      </span>
    </button>
  )
}

function ArcadeHotspot({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      className="arcade-hotspot"
      type="button"
      onClick={onOpen}
      aria-label="Abrir máquina recreativa"
    />
  )
}

function MobileStationIcon({ id }: { id: AgentId }) {
  if (id === 'prospecto') return <Send aria-hidden="true" />
  if (id === 'bardo') return <MessageSquareReply aria-hidden="true" />
  if (id === 'marketing') return <Palette aria-hidden="true" />
  return <History aria-hidden="true" />
}

function MobileStationDock({ onOpen, onArcade }: {
  onOpen: (id: AgentId) => void
  onArcade: () => void
}) {
  return (
    <nav className="mobile-station-dock" aria-label="Puestos del garaje">
      <header>
        <strong>Puestos del garaje</strong>
        <span>Toca para abrir</span>
      </header>
      <div className="mobile-station-list">
        {agents.map((agent) => (
          <button key={agent.id} type="button" data-agent={agent.id} onClick={() => onOpen(agent.id)}>
            <MobileStationIcon id={agent.id} />
            <span><strong>{agent.name}</strong><small>{agent.id === 'marketing' ? 'Crear imágenes' : agent.action}</small></span>
          </button>
        ))}
        <button className="mobile-arcade-button" type="button" onClick={onArcade}>
          <Gamepad2 aria-hidden="true" />
          <span><strong>Recreativa</strong><small>Snake y bloques</small></span>
        </button>
      </div>
    </nav>
  )
}

function LoginScreen({ csrfToken, setupRequired, onAuthenticated, onRefreshSecurity }: {
  csrfToken: string
  setupRequired: boolean
  onAuthenticated: (result: LoginResult) => void
  onRefreshSecurity: () => Promise<void>
}) {
  const [email, setEmail] = useState(INITIAL_EMAIL)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!email.trim() || !password) {
      setError('Introduce tu correo y contraseña.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const response = await authApi.login(email.trim(), password, csrfToken)
      setPassword('')
      onAuthenticated(response)
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === 'INVALID_CSRF') await onRefreshSecurity()
      setError(caught instanceof Error ? caught.message : 'No se pudo iniciar sesión.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-shell">
      <div className="login-kinetic" aria-hidden="true">
        <span className="kinetic-halo kinetic-halo-a" />
        <span className="kinetic-halo kinetic-halo-b" />
        <span className="kinetic-sweep" />
        <svg className="kinetic-cables" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
          <path className="kinetic-cable cable-a" d="M-80 700 C260 420 360 780 720 500 S1230 250 1680 500" />
          <path className="kinetic-cable cable-b" d="M-120 250 C290 520 470 120 850 390 S1290 760 1700 350" />
          <path className="kinetic-cable cable-c" d="M260 -80 C390 270 720 230 860 520 S1100 860 1390 940" />
          <circle className="kinetic-node node-a" cx="530" cy="574" r="9" />
          <circle className="kinetic-node node-b" cx="904" cy="430" r="9" />
          <circle className="kinetic-node node-c" cx="1244" cy="387" r="9" />
        </svg>
        <span className="kinetic-orbit orbit-a" />
        <span className="kinetic-orbit orbit-b" />
      </div>

      <section className="login-console" aria-label="Acceso a Garaje Kaam">
        <GarageMark />
        <form className="login-form" onSubmit={submit} noValidate>
          <label className="login-field">
            <span className="sr-only">Correo</span>
            <AtSign aria-hidden="true" />
            <input
              type="email"
              value={email}
              onChange={(event) => { setEmail(event.target.value); setError('') }}
              autoComplete="username"
              placeholder="correo"
              autoFocus
              required
            />
          </label>
          <label className="login-field">
            <span className="sr-only">Contraseña</span>
            <LockKeyhole aria-hidden="true" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => { setPassword(event.target.value); setError('') }}
              autoComplete="current-password"
              placeholder="contraseña"
              required
            />
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </button>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          {setupRequired && <p className="login-error" role="status">No hay ningún administrador. Ejecuta <code>npm run user:init</code> en el servidor.</p>}
          <button className="login-submit" type="submit" aria-label="Entrar al garaje" disabled={submitting || setupRequired || !csrfToken}>
            {submitting ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <LogIn aria-hidden="true" />}
          </button>
        </form>
      </section>
    </main>
  )
}

function SessionLoading({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <main className="login-shell">
      <div className="login-kinetic" aria-hidden="true"><span className="kinetic-halo kinetic-halo-a" /><span className="kinetic-orbit orbit-b" /></div>
      <section className="session-loading" aria-live="polite">
        <GarageMark />
        {error ? (
          <><p>{error}</p><button type="button" onClick={onRetry}>Reintentar conexión</button></>
        ) : (
          <><LoaderCircle className="is-spinning" aria-hidden="true" /><span>Verificando acceso…</span></>
        )}
      </section>
    </main>
  )
}

function EntryTransition() {
  return (
    <div className="entry-transition" aria-hidden="true">
      <span className="door-slat" /><span className="door-slat" /><span className="door-slat" />
      <span className="door-slat" /><span className="door-slat" /><span className="door-slat" />
      <span className="entry-trace"><i /><i /><i /></span>
    </div>
  )
}

function App() {
  const [entering, setEntering] = useState(false)
  const [activeAgent, setActiveAgent] = useState<AgentId | null>(null)
  const [arcadeOpen, setArcadeOpen] = useState(false)
  const [usersOpen, setUsersOpen] = useState(false)
  const garageViewportRef = useRef<HTMLDivElement>(null)
  const [garageCanPan, setGarageCanPan] = useState(false)

  const clearPrivateViews = useCallback(() => {
    setActiveAgent(null)
    setArcadeOpen(false)
    setUsersOpen(false)
    setEntering(false)
  }, [])
  const { authPhase, sessionState, setSessionState, authError, sessionMessage, setSessionMessage,
    refreshSession, completeLogin, logout, expireSession } = useSession(clearPrivateViews)

  useEffect(() => {
    if (authPhase !== 'authenticated') return
    const viewport = garageViewportRef.current
    if (!viewport) return
    viewport.scrollLeft = 0
    const updatePan = () => setGarageCanPan(viewport.scrollWidth > viewport.clientWidth + 1)
    const observer = new ResizeObserver(updatePan)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
    updatePan()
    return () => observer.disconnect()
  }, [authPhase])

  useEffect(() => {
    if (!entering) return
    const finishTimer = window.setTimeout(() => setEntering(false), 1180)
    return () => {
      window.clearTimeout(finishTimer)
    }
  }, [entering])

  const authenticatedUser = sessionState?.authenticated ? sessionState.user : null

  return (
    <>
      {authPhase === 'checking' || authPhase === 'unavailable' ? (
        <SessionLoading error={authPhase === 'unavailable' ? authError : ''} onRetry={() => void refreshSession()} />
      ) : authPhase === 'anonymous' ? (
        <LoginScreen
          csrfToken={sessionState?.csrfToken || ''}
          setupRequired={Boolean(sessionState?.setupRequired)}
          onAuthenticated={(result) => { completeLogin(result); setEntering(true) }}
          onRefreshSecurity={refreshSession}
        />
      ) : (
        <>
          <ProductsProvider>
          <a className="skip-link" href="#garaje">Saltar al garaje</a>
          <div className="app-shell">
            <header className="topbar">
              <GarageMark />
              <ProductSelector />
              <div className="topbar-actions">
                <button className="topbar-icon" type="button" onClick={() => setArcadeOpen(true)} aria-label="Abrir recreativa" title="Recreativa"><Gamepad2 /></button>
                {authenticatedUser?.role === 'admin' && (
                  <button className="topbar-icon" type="button" onClick={() => setUsersOpen(true)} aria-label="Gestionar usuarios" title="Usuarios"><UserRoundCog /></button>
                )}
                <span className="system-dot" role="img" aria-label="Sistema en marcha"><i /></span>
                <button className="topbar-icon" type="button" onClick={() => void logout()} aria-label="Cerrar sesión" title="Cerrar sesión">
                  <LogOut />
                </button>
              </div>
            </header>

            <main id="garaje">
              <section className="garage-stage" aria-label="Centro de control del garaje">
                <div
                  ref={garageViewportRef}
                  className="garage-viewport"
                  role="region"
                  aria-label="Panorámica del garaje"
                  aria-describedby={garageCanPan ? 'garage-pan-hint' : undefined}
                  tabIndex={garageCanPan ? 0 : undefined}
                >
                  <div className="garage-scene">
                    <div className="garage-camera">
                      <img className="garage-poster" src={garagePoster} alt="Garaje doméstico con cinco personajes sentados, puestos de trabajo y una recreativa" />
                      <div className="cinema-vignette" aria-hidden="true" />
                    </div>
                    <div className="stations-grid">
                      {agents.map((agent) => (
                        <AgentStation key={agent.id} agent={agent} onOpen={setActiveAgent} />
                      ))}
                      <ArcadeHotspot onOpen={() => setArcadeOpen(true)} />
                    </div>
                  </div>
                </div>
                {garageCanPan && (
                  <p id="garage-pan-hint" className="garage-pan-hint">
                    <MoveHorizontal aria-hidden="true" /> Desliza para recorrer el garaje
                  </p>
                )}
                <MobileStationDock onOpen={setActiveAgent} onArcade={() => setArcadeOpen(true)} />
              </section>
            </main>
          </div>

          <DashboardModal agent={activeAgent} onClose={() => setActiveAgent(null)} csrfToken={sessionState?.csrfToken ?? ''} />
          <ArcadeModal open={arcadeOpen} onClose={() => setArcadeOpen(false)} />
          {authenticatedUser?.role === 'admin' && sessionState && (
            <UserManagementModal
              open={usersOpen}
              currentUser={authenticatedUser}
              csrfToken={sessionState.csrfToken}
              onClose={() => setUsersOpen(false)}
              onSessionExpired={expireSession}
              onCurrentUserChange={(user) => setSessionState((current) => current ? { ...current, user } : current)}
            />
          )}
          </ProductsProvider>
        </>
      )}
      {sessionMessage && (
        <div className="session-toast" role="alert">
          <span>{sessionMessage}</span>
          <button type="button" onClick={() => setSessionMessage('')} aria-label="Cerrar aviso"><X /></button>
        </div>
      )}
      {entering && <EntryTransition />}
    </>
  )
}

export default App
