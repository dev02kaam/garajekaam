import { useProducts } from '../productContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, Check, Download, ImagePlus, LoaderCircle, RefreshCcw, Search, Upload, X, ZoomIn } from 'lucide-react'
import { ApiError } from '../auth'
import { type CampaignImage } from '../workflowApi'
import './CampaignImages.css'

type UploadResult = { name: string; state: 'pending' | 'uploading' | 'saved' | 'duplicate' | 'failed'; message?: string }
const maxBytes = 10 * 1024 * 1024
const sizeLabel = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`
const fileProblem = (file: File) => file.size > maxBytes ? 'Supera los 10 MB.'
  : !file.size ? 'El archivo está vacío.' : !/\.(png|jpe?g|webp)$/i.test(file.name) ? 'Usa PNG, JPG o WebP.' : ''
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'No se pudo guardar el cambio. Vuelve a intentarlo.'

function ImagePreview({ image, full = false }: { image: CampaignImage; full?: boolean }) {
  const { api: { campaignImageUrl } } = useProducts()
  const [failed, setFailed] = useState(false)
  return failed ? <span className="campaign-images-preview-error"><AlertTriangle aria-hidden="true" />No se puede mostrar. Puedes descargar o sustituir esta imagen.</span>
    : <img src={campaignImageUrl(image, full ? 'preview' : 'thumbnail')} alt={image.fileName} loading={full ? 'eager' : 'lazy'} onError={() => setFailed(true)} />
}

export function CampaignImages({ csrfToken }: { csrfToken: string }) {
  const { api: workflowApi, product } = useProducts()
  const { campaignImageUrl } = workflowApi
  const [images, setImages] = useState<CampaignImage[]>([])
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable' | 'error'>('loading')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [query, setQuery] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [results, setResults] = useState<UploadResult[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [replacement, setReplacement] = useState<{ file: File; url: string; target: CampaignImage } | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const replaceRef = useRef<HTMLInputElement>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const lastImageButtonId = useRef<string | null>(null)
  const alive = useRef(true)
  const uploadController = useRef<AbortController | null>(null)
  const mutationPending = useRef(false)

  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await workflowApi.campaignImages(signal)
      if (!alive.current || signal?.aborted) return
      setImages(result.images)
      setState(result.available ? 'ready' : 'unavailable')
    } catch (caught) {
      if (!alive.current || signal?.aborted) return
      setState('error')
      setError(errorMessage(caught))
    }
  }, [workflowApi])

  useEffect(() => {
    alive.current = true
    const controller = new AbortController()
    void load(controller.signal)
    return () => { alive.current = false; controller.abort(); uploadController.current?.abort() }
  }, [load])
  useEffect(() => () => { if (replacement) URL.revokeObjectURL(replacement.url) }, [replacement])
  useEffect(() => {
    if (selectedId) backRef.current?.focus()
    else if (lastImageButtonId.current) {
      // Restore focus after React has mounted the gallery again. A renamed
      // replacement may no longer match the current search, so fall back to it.
      const button = document.getElementById(lastImageButtonId.current)
      if (button) button.focus()
      else searchRef.current?.focus()
    }
  }, [selectedId])

  const selected = images.find((image) => image.id === selectedId)
  const activeCount = images.filter((image) => image.active).length
  const visible = images.filter((image) => (filter === 'all' || image.active === (filter === 'active')) && image.fileName.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()))
  const unavailable = state !== 'ready'

  async function uploadFiles(files: File[]) {
    if (!files.length || mutationPending.current || unavailable) return
    if (files.length > 20) { setError('Selecciona hasta 20 imágenes cada vez.'); return }
    mutationPending.current = true
    setBusy(true)
    setError('')
    setMessage('')
    setResults(files.map((file) => ({ name: file.name, state: 'pending' })))
    const controller = new AbortController()
    uploadController.current = controller
    let saved = 0
    let duplicates = 0
    let failed = 0
    const update = (index: number, result: Partial<UploadResult>) => {
      if (alive.current) setResults((current) => current.map((item, n) => n === index ? { ...item, ...result } : item))
    }
    try {
      for (const [index, file] of files.entries()) {
        if (controller.signal.aborted) break
        const problem = fileProblem(file)
        if (problem) { failed++; update(index, { state: 'failed', message: problem }); continue }
        update(index, { state: 'uploading' })
        try {
          const result = await workflowApi.uploadCampaignImage(file, csrfToken, controller.signal)
          if (result.duplicate) duplicates++; else saved++
          update(index, { state: result.duplicate ? 'duplicate' : 'saved' })
        } catch (caught) {
          if (controller.signal.aborted) break
          failed++
          update(index, { state: 'failed', message: errorMessage(caught) })
          if (caught instanceof ApiError && (caught.status === 0 || caught.status >= 500 || caught.status === 401 || caught.status === 403 || caught.status === 429)) {
            if (alive.current) setResults((current) => current.map((item, n) => n > index ? { ...item, state: 'failed', message: 'Pendiente de subir. Vuelve a seleccionarla cuando recuperes la conexión.' } : item))
            break
          }
        }
      }
      if (alive.current && !controller.signal.aborted) {
        setMessage(`${saved} guardadas · ${duplicates} ya estaban en la biblioteca${failed ? ` · ${failed} con error` : ''}. Las nuevas quedan sin activar.`)
        await load(controller.signal)
      }
    } finally {
      mutationPending.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function change(work: () => Promise<{ image: CampaignImage }>, success: string) {
    if (mutationPending.current) return
    mutationPending.current = true
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const result = await work()
      if (!alive.current) return
      setImages((current) => current.map((image) => image.id === result.image.id ? result.image : image))
      setReplacement(null)
      setMessage(success)
    } catch (caught) {
      if (!alive.current) return
      setError(errorMessage(caught))
      if (caught instanceof ApiError && caught.status === 409) await load()
    } finally {
      mutationPending.current = false
      if (alive.current) setBusy(false)
    }
  }

  function closePreview() {
    setSelectedId(null)
    setReplacement(null)
    setError('')
  }

  return <section id="campaign-images-panel" className="campaign-images" role="tabpanel" aria-labelledby="campaign-images-tab">
    <header className="campaign-images-heading">
      <div><h3>Imágenes de campañas</h3><p>Elige las imágenes que acompañan a tus correos.</p></div>
      <button type="button" className="campaign-images-upload" disabled={busy || unavailable} onClick={() => uploadRef.current?.click()}><Upload aria-hidden="true" />Subir imágenes</button>
      <input ref={uploadRef} hidden aria-label="Seleccionar imágenes desde tus carpetas" type="file" multiple accept="image/png,image/jpeg,image/webp" disabled={busy || unavailable} onChange={(event) => { void uploadFiles(Array.from(event.target.files || [])); event.target.value = '' }} />
    </header>

    <p className="campaign-images-scope">{product.status === 'preparing'
      ? 'Biblioteca propia de DECA. La selección se guarda para futuras campañas; los envíos siguen pendientes de configuración.'
      : 'Lista compartida por todas las campañas de Ficharia. Cada correo usa una imagen activa. Los cambios se aplican a los próximos envíos, también en campañas en marcha.'}</p>
    <div className="campaign-images-feedback" aria-live="polite" role="status">{message && <p><Check aria-hidden="true" />{message}</p>}</div>
    {error && <p className="campaign-images-error" role="alert"><AlertTriangle aria-hidden="true" />{error}</p>}

    {state === 'loading' && <div className="campaign-images-empty" role="status"><LoaderCircle className="spin" aria-hidden="true" /><p>Cargando tus imágenes…</p></div>}
    {state === 'unavailable' && <div className="campaign-images-empty"><ImagePlus aria-hidden="true" /><h4>La biblioteca aún no está disponible</h4><p>Falta conectar el almacenamiento de imágenes de campañas.</p><button type="button" onClick={() => void load()}><RefreshCcw aria-hidden="true" />Volver a comprobar</button></div>}
    {state === 'error' && <div className="campaign-images-empty"><h4>No se pudo cargar la biblioteca</h4><button type="button" onClick={() => { setError(''); void load() }}><RefreshCcw aria-hidden="true" />Volver a intentar</button></div>}

    {state === 'ready' && <>
      {selected ? <div className="campaign-images-detail">
        <button ref={backRef} type="button" className="campaign-images-back" disabled={busy} onClick={closePreview}><ArrowLeft aria-hidden="true" />Volver a la galería</button>
        <div className="campaign-images-detail-layout">
          <div className="campaign-images-large"><ImagePreview key={selected.sha256} image={selected} full /></div>
          <div className="campaign-images-details">
            <span className="campaign-images-status" data-active={selected.active}>{selected.active ? 'En uso' : 'Sin usar'}</span>
            <h4>{selected.fileName}</h4><p>{selected.mimeType.replace('image/', '').toUpperCase()} · {sizeLabel(selected.sizeBytes)}</p>
            <p>{selected.active ? 'Participa en los próximos envíos.' : 'Está guardada. Actívala cuando quieras incluirla en los envíos.'}</p>
            <button type="button" disabled={busy || (selected.active && activeCount === 1)} onClick={() => void change(() => workflowApi.setCampaignImageActive(selected, !selected.active, csrfToken), selected.active ? 'Imagen retirada de los próximos envíos. El archivo sigue guardado.' : 'Imagen activada para los próximos envíos.')}>{selected.active ? 'Retirar de los envíos' : 'Usar en los envíos'}</button>
            {selected.active && activeCount === 1 && <small>Activa otra imagen antes de retirar la última.</small>}
            <a href={campaignImageUrl(selected, 'download')} download><Download aria-hidden="true" />Descargar original</a>
            <button type="button" disabled={busy} onClick={() => replaceRef.current?.click()}><RefreshCcw aria-hidden="true" />Sustituir imagen</button>
            <input ref={replaceRef} type="file" hidden aria-label="Seleccionar sustitución" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (!file) return
              const problem = fileProblem(file)
              if (problem) { setError(problem); return }
              setError('')
              setReplacement({ file, url: URL.createObjectURL(file), target: selected })
            }} />
          </div>
        </div>
        {replacement && <section className="campaign-images-replacement" aria-label="Revisar sustitución">
          <img src={replacement.url} alt={`Nueva imagen: ${replacement.file.name}`} />
          <div><h4>Revisar sustitución</h4><p>{replacement.file.name}</p><p>{replacement.target.active ? 'La nueva imagen ocupará su lugar en los próximos envíos.' : 'La nueva imagen quedará guardada sin activar.'} El archivo anterior será reemplazado; descárgalo antes si quieres conservarlo.</p>
            <div className="campaign-images-replacement-actions"><button type="button" disabled={busy} onClick={() => void change(() => workflowApi.replaceCampaignImage(replacement.target, replacement.file, csrfToken), 'Imagen sustituida. Se ha conservado su estado de uso.')}><Check aria-hidden="true" />{busy ? 'Guardando…' : 'Confirmar sustitución'}</button><button type="button" disabled={busy} onClick={() => setReplacement(null)}><X aria-hidden="true" />Cancelar</button></div>
          </div>
        </section>}
      </div> : <>
        <div className={`campaign-images-drop ${dragging ? 'is-dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); if (!busy && !unavailable) setDragging(true) }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false) }} onDrop={(event) => { event.preventDefault(); setDragging(false); void uploadFiles(Array.from(event.dataTransfer.files)) }}>
          <ImagePlus aria-hidden="true" /><div><strong>Arrastra aquí tus imágenes</strong><span>PNG, JPG o WebP · Hasta 10 MB por imagen · Se guardan sin activar</span></div><button type="button" disabled={busy} onClick={() => uploadRef.current?.click()}>Elegir archivos</button>
        </div>
        <div className="campaign-images-toolbar">
          <div className="campaign-images-filters" aria-label="Filtrar imágenes">{([['all', 'Todas', images.length], ['active', 'En uso', activeCount], ['inactive', 'Sin usar', images.length - activeCount]] as const).map(([value, label, count]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span>{count}</span></button>)}</div>
          <label className="campaign-images-search"><Search aria-hidden="true" /><span className="sr-only">Buscar imágenes por nombre</span><input ref={searchRef} type="search" placeholder="Buscar por nombre" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <button type="button" className="campaign-images-refresh" disabled={busy} aria-label="Actualizar biblioteca" title="Actualizar biblioteca" onClick={() => { setError(''); void load() }}><RefreshCcw aria-hidden="true" /></button>
        </div>
        {images.length > 0 && !activeCount && <p className="campaign-images-error"><AlertTriangle aria-hidden="true" />Activa al menos una imagen para que se utilice en los correos.</p>}
        {visible.length ? <div className="campaign-images-grid">{visible.map((image) => <article className="campaign-images-item" key={image.id}>
          <button type="button" className="campaign-images-thumbnail" id={`campaign-image-${image.id}`} disabled={busy} aria-label={`Ampliar ${image.fileName}`} onClick={(event) => { lastImageButtonId.current = event.currentTarget.id; setSelectedId(image.id); setError(''); setMessage('') }}><ImagePreview key={image.sha256} image={image} /><span><ZoomIn aria-hidden="true" />Ampliar</span></button>
          <div className="campaign-images-item-info"><h4 title={image.fileName}>{image.fileName}</h4><div><span className="campaign-images-status" data-active={image.active}>{image.active ? 'En uso' : 'Sin usar'}</span><small>{sizeLabel(image.sizeBytes)}</small></div></div>
          <div className="campaign-images-item-actions"><button type="button" disabled={busy || (image.active && activeCount === 1)} title={image.active && activeCount === 1 ? 'Activa otra imagen antes de retirar la última.' : undefined} aria-label={`${image.active ? 'Retirar de los envíos' : 'Usar en los envíos'}: ${image.fileName}`} onClick={() => void change(() => workflowApi.setCampaignImageActive(image, !image.active, csrfToken), image.active ? 'Imagen retirada de los envíos. Sigue guardada en tu biblioteca.' : 'Imagen activada para los próximos envíos.')}>{image.active ? 'Retirar' : 'Usar en envíos'}</button><a href={campaignImageUrl(image, 'download')} download aria-label={`Descargar ${image.fileName}`} title="Descargar original"><Download aria-hidden="true" /></a></div>
        </article>)}</div> : <div className="campaign-images-empty"><ImagePlus aria-hidden="true" /><h4>{images.length ? 'No hay imágenes con ese filtro' : 'Tu biblioteca está lista para la primera imagen'}</h4><p>{images.length ? 'Prueba otro nombre o muestra todas las imágenes.' : 'Sube una imagen desde tus carpetas y actívala para usarla en los envíos.'}</p></div>}
      </>}
      {results.length > 0 && <section className="campaign-images-results" aria-label="Resultado de la subida" aria-live="polite"><h4>{busy ? 'Subiendo imágenes…' : 'Resultado de la subida'}</h4><ul>{results.map((item, index) => <li key={index} data-state={item.state}><span>{item.name}</span><span>{item.state === 'uploading' ? <><LoaderCircle className="spin" aria-hidden="true" />Subiendo…</> : item.state === 'pending' ? 'En espera' : item.state === 'saved' ? 'Guardada · sin activar' : item.state === 'duplicate' ? 'Ya estaba guardada' : item.message}</span></li>)}</ul></section>}
    </>}
  </section>
}
