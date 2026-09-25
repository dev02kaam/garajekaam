import { useEffect, useState } from 'react'
import { Search, RefreshCcw } from 'lucide-react'
import { useProducts } from '../productContext'
import type { WorkflowOptout } from '../workflowApi'

const date = (value: string | null) => value ? new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Madrid' }).format(new Date(value)) : '—'
const confirmation = (status: WorkflowOptout['confirmationStatus']) => status ? ({ pending: 'Confirmación pendiente', drafting: 'Preparando confirmación', sending: 'Enviando confirmación', sent: 'Confirmación enviada', delivery_unknown: 'Entrega sin confirmar' }[status]) : 'Sin confirmación registrada'

export function BardoOptouts() {
  const { api, product } = useProducts()
  const [query, setQuery] = useState('')
  const [offset, setOffset] = useState(0)
  const [version, setVersion] = useState(0)
  const [rows, setRows] = useState<WorkflowOptout[]>([])
  const [total, setTotal] = useState(0)
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading')
  useEffect(() => {
    const controller = new AbortController()
    let busy = false
    setState('loading')
    const load = async () => {
      if (busy) return
      busy = true
      try {
        const result = await api.optouts({ query, offset, limit: 50 }, controller.signal)
        if (controller.signal.aborted) return
        setRows(result.optouts)
        setTotal(result.total)
        setState(result.available ? 'ready' : 'unavailable')
      } catch {
        if (!controller.signal.aborted) setState('error')
      } finally { busy = false }
    }
    const debounce = window.setTimeout(() => void load(), 200)
    const interval = window.setInterval(() => { if (document.visibilityState === 'visible') void load() }, 15_000)
    return () => { controller.abort(); window.clearTimeout(debounce); window.clearInterval(interval) }
  }, [api, query, offset, version])
  return (
    <section id="bardo-optouts-panel" className="bardo-history-panel bardo-optouts" role="tabpanel" aria-labelledby="bardo-optouts-tab">
      <header className="bardo-history-heading">
        <div><h3>Bajas</h3><p>Direcciones excluidas de las campañas y los seguimientos de {product.name}.</p></div>
        <span>{state === 'ready' ? `${total} ${total === 1 ? 'baja' : 'bajas'}` : 'Registro de bajas'}</span>
      </header>
      <div className="bardo-optout-tools">
        <label className="bardo-search"><span className="sr-only">Buscar bajas por correo o dominio</span><Search aria-hidden="true" />
          <input type="search" value={query} maxLength={200} placeholder="Correo o dominio" onChange={event => { setQuery(event.target.value); setOffset(0) }} />
        </label>
        <button type="button" className="bardo-optout-refresh" onClick={() => setVersion(value => value + 1)} disabled={state === 'loading'}><RefreshCcw aria-hidden="true" />Actualizar</button>
      </div>
      <p className="bardo-optout-note">La baja se aplica antes de enviar la confirmación. Una confirmación pendiente no reactiva los envíos.</p>
      {state === 'loading' ? <p role="status">Cargando bajas…</p> : state === 'error' ? <p role="alert">No se han podido cargar las bajas. Pulsa «Actualizar» para volver a intentarlo.</p> : state === 'unavailable' ? <p role="status">El registro de bajas todavía no está disponible.</p> : rows.length === 0 ? <p role="status">{query ? 'No hay bajas que coincidan con la búsqueda.' : 'Todavía no hay bajas registradas.'}</p> : (
        <ul className="bardo-optout-list" aria-label="Direcciones dadas de baja">
          {rows.map(row => <li key={row.email}>
            <div><strong>{row.email}</strong><small>{row.reason === 'delete_data' ? 'Solicitud de eliminación' : 'Baja de comunicaciones'} · {date(row.optedOutAt)}</small></div>
            <div className="bardo-optout-delivery"><span>Excluida de envíos</span><small>{confirmation(row.confirmationStatus)}{row.confirmedAt ? ` · ${date(row.confirmedAt)}` : ''}</small></div>
          </li>)}
        </ul>
      )}
      {state === 'ready' && total > 50 && <nav className="bardo-optout-pages" aria-label="Páginas de bajas">
        <button type="button" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 50))}>Anterior</button>
        <span>{offset + 1}–{Math.min(offset + 50, total)} de {total}</span>
        <button type="button" disabled={offset + 50 >= total} onClick={() => setOffset(value => value + 50)}>Siguiente</button>
      </nav>}
    </section>
  )
}
