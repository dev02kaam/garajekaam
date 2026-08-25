import {
  AlertTriangle,
  Check,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundCheck,
  UserRoundX,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ApiError, authApi, type SessionUser, type UserRole, type UserStatus } from '../auth'

type UserManagementModalProps = {
  open: boolean
  currentUser: SessionUser
  csrfToken: string
  onClose: () => void
  onSessionExpired: () => void
  onCurrentUserChange: (user: SessionUser) => void
}

type FormState = {
  displayName: string
  email: string
  role: UserRole
  status: UserStatus
  password: string
}

const emptyForm: FormState = {
  displayName: '',
  email: '',
  role: 'operator',
  status: 'active',
  password: '',
}

const dateFormatter = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' })

function formatMoment(value: string | null) {
  if (!value) return 'Nunca'
  return dateFormatter.format(new Date(value))
}

function initials(user: Pick<SessionUser, 'displayName' | 'email'>) {
  const parts = user.displayName.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return user.email.slice(0, 2).toUpperCase()
  return `${parts[0][0] || ''}${parts.at(-1)?.[0] || ''}`.toUpperCase()
}

export default function UserManagementModal({
  open,
  currentUser,
  csrfToken,
  onClose,
  onSessionExpired,
  onCurrentUserChange,
}: UserManagementModalProps) {
  const modalRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const [users, setUsers] = useState<SessionUser[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const selectedUser = users.find((user) => user.id === selectedId) || null
  const activeUserCount = users.filter((user) => user.status === 'active').length
  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('es')
    if (!normalized) return users
    return users.filter((user) => `${user.displayName} ${user.email} ${user.role} ${user.status}`.toLocaleLowerCase('es').includes(normalized))
  }, [query, users])

  const handleApiError = useCallback((caught: unknown) => {
    if (caught instanceof ApiError && caught.status === 401) {
      onSessionExpired()
      return
    }
    setError(caught instanceof Error ? caught.message : 'No se pudo completar la operación.')
  }, [onSessionExpired])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response = await authApi.listUsers()
      setUsers(response.users)
    } catch (caught) {
      handleApiError(caught)
    } finally {
      setLoading(false)
    }
  }, [handleApiError])

  useEffect(() => {
    if (!open) return
    previousFocus.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    void loadUsers()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (modalRef.current?.querySelector('.user-delete-confirm')) {
          setConfirmDelete(false)
          return
        }
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const focusRoot = modalRef.current?.querySelector<HTMLElement>('.user-delete-confirm') ?? modalRef.current
      const focusable = Array.from(focusRoot?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? []).filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !focusRoot?.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.body.classList.add('modal-open')
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('modal-open')
      window.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus()
    }
  }, [open, onClose, loadUsers])

  useEffect(() => {
    if (confirmDelete) cancelDeleteRef.current?.focus()
  }, [confirmDelete])

  useEffect(() => {
    if (creating) {
      setForm(emptyForm)
      setConfirmDelete(false)
      setError('')
      return
    }
    if (!selectedUser) return
    setForm({
      displayName: selectedUser.displayName,
      email: selectedUser.email,
      role: selectedUser.role,
      status: selectedUser.status,
      password: '',
    })
    setConfirmDelete(false)
    setError('')
  }, [creating, selectedUser])

  if (!open) return null

  const selectUser = (user: SessionUser) => {
    setCreating(false)
    setSelectedId(user.id)
    setNotice('')
  }

  const startCreating = () => {
    setSelectedId(null)
    setCreating(true)
    setNotice('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (creating) {
        const response = await authApi.createUser({
          displayName: form.displayName,
          email: form.email,
          role: form.role,
          password: form.password,
        }, csrfToken)
        setUsers((current) => [...current, response.user])
        setCreating(false)
        setSelectedId(response.user.id)
        setNotice('Usuario creado y listo para entrar.')
      } else if (selectedUser) {
        const response = await authApi.updateUser(selectedUser.id, form, csrfToken)
        setUsers((current) => current.map((user) => user.id === response.user.id ? response.user : user))
        if (response.user.id === currentUser.id && form.password) {
          onSessionExpired()
          return
        }
        if (response.user.id === currentUser.id) onCurrentUserChange(response.user)
        setNotice('Cambios guardados.')
      }
    } catch (caught) {
      handleApiError(caught)
    } finally {
      setSaving(false)
    }
  }

  const deleteSelected = async () => {
    if (!selectedUser) return
    setDeleting(true)
    setError('')
    try {
      await authApi.deleteUser(selectedUser.id, csrfToken)
      setUsers((current) => current.filter((user) => user.id !== selectedUser.id))
      setSelectedId(null)
      setConfirmDelete(false)
      setNotice('Usuario eliminado definitivamente.')
    } catch (caught) {
      handleApiError(caught)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="modal-backdrop users-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={modalRef} className="users-modal" role="dialog" aria-modal="true" aria-labelledby="users-title">
        <header className="users-modal-header">
          <div>
            <UserRoundCheck aria-hidden="true" />
            <span>
              <h2 id="users-title">Accesos al garaje</h2>
              <small>{activeUserCount} {activeUserCount === 1 ? 'cuenta activa' : 'cuentas activas'}</small>
            </span>
          </div>
          <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Cerrar gestión de usuarios"><X /></button>
        </header>

        <div className="users-toolbar">
          <label>
            <Search aria-hidden="true" />
            <span className="sr-only">Buscar usuarios</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, correo o rol" />
          </label>
          <button type="button" onClick={startCreating}><Plus aria-hidden="true" /> Nuevo usuario</button>
        </div>

        <div className="users-workspace">
          <section className="users-index" aria-label="Usuarios">
            {loading ? (
              <div className="users-state"><LoaderCircle className="is-spinning" aria-hidden="true" /><span>Cargando accesos…</span></div>
            ) : filteredUsers.length ? (
              <ul>
                {filteredUsers.map((user) => (
                  <li key={user.id}>
                    <button type="button" className={selectedId === user.id && !creating ? 'is-selected' : ''} onClick={() => selectUser(user)} aria-pressed={selectedId === user.id && !creating}>
                      <span className="user-avatar" aria-hidden="true">{initials(user)}</span>
                      <span className="user-index-copy">
                        <strong>{user.displayName}</strong>
                        <small>{user.email}</small>
                      </span>
                      <span className="user-index-meta">
                        <small>{user.role === 'admin' ? 'Administrador' : 'Operador'}</small>
                        <span data-status={user.status}>{user.status === 'active' ? 'Activo' : 'Desactivado'}</span>
                      </span>
                      <Pencil aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="users-state"><UserRoundX aria-hidden="true" /><strong>Sin coincidencias</strong><span>Prueba con otro nombre o correo.</span></div>
            )}
          </section>

          <section className="user-editor" aria-live="polite">
            {(creating || selectedUser) ? (
              <form onSubmit={submit}>
                <header>
                  <span className="user-editor-avatar" aria-hidden="true">{creating ? <Plus /> : initials(selectedUser!)}</span>
                  <span>
                    <h3>{creating ? 'Dar acceso' : selectedUser!.displayName}</h3>
                    <small>{creating ? 'Crea una cuenta de acceso' : `Último acceso: ${formatMoment(selectedUser!.lastLoginAt)}`}</small>
                  </span>
                </header>

                <div className="user-form-grid">
                  <label>
                    <span>Nombre visible</span>
                    <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} minLength={2} maxLength={80} required autoComplete="name" />
                  </label>
                  <label>
                    <span>Correo</span>
                    <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} maxLength={254} required autoComplete="email" />
                  </label>
                  <label>
                    <span>Rol</span>
                    <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as UserRole }))}>
                      <option value="operator">Operador</option>
                      <option value="admin">Administrador</option>
                    </select>
                    <small>{form.role === 'admin' ? 'Puede gestionar usuarios y workflows.' : 'Puede operar los workflows, sin gestionar usuarios.'}</small>
                  </label>
                  {!creating && (
                    <label>
                      <span>Estado</span>
                      <select value={form.status} disabled={selectedUser?.id === currentUser.id} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))}>
                        <option value="active">Activo</option>
                        <option value="disabled">Desactivado</option>
                      </select>
                      {selectedUser?.id === currentUser.id && <small>No puedes desactivar tu propia cuenta.</small>}
                    </label>
                  )}
                  <label className="user-password-field">
                    <span><KeyRound aria-hidden="true" /> {creating ? 'Contraseña temporal' : 'Nueva contraseña'}</span>
                    <input type="password" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} minLength={12} maxLength={128} required={creating} autoComplete="new-password" placeholder={creating ? 'Mínimo 12 caracteres' : 'Déjala vacía para conservarla'} />
                    <small>{creating ? 'Compártela por un canal seguro.' : 'Solo se modificará si completas este campo.'}</small>
                  </label>
                </div>

                {error && <p className="user-form-message is-error" role="alert"><AlertTriangle aria-hidden="true" />{error}</p>}
                {notice && <p className="user-form-message is-success" role="status"><Check aria-hidden="true" />{notice}</p>}

                <div className="user-editor-actions">
                  {!creating && selectedUser?.id !== currentUser.id && (
                    <button className="user-delete-trigger" type="button" disabled={selectedUser?.status !== 'disabled'} onClick={() => setConfirmDelete(true)} title={selectedUser?.status === 'disabled' ? 'Eliminar usuario' : 'Desactiva la cuenta antes de eliminarla'}>
                      <Trash2 aria-hidden="true" /> Eliminar
                    </button>
                  )}
                  <button className="user-save" type="submit" disabled={saving}>
                    {saving ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <ShieldCheck aria-hidden="true" />}
                    {saving ? 'Guardando…' : creating ? 'Crear acceso' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="user-editor-empty">
                <UserRound aria-hidden="true" />
                <strong>Selecciona un usuario</strong>
                <span>Edita sus permisos o crea un acceso nuevo.</span>
              </div>
            )}

            {confirmDelete && selectedUser && (
              <div className="user-delete-confirm" role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title">
                <AlertTriangle aria-hidden="true" />
                <h3 id="delete-user-title">¿Eliminar a {selectedUser.displayName}?</h3>
                <p>Se revocarán sus sesiones y la cuenta desaparecerá. Esta acción no se puede deshacer.</p>
                <div>
                  <button ref={cancelDeleteRef} type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                  <button type="button" onClick={() => void deleteSelected()} disabled={deleting}>{deleting ? 'Eliminando…' : 'Eliminar definitivamente'}</button>
                </div>
              </div>
            )}
          </section>
        </div>
      </section>
    </div>
  )
}
