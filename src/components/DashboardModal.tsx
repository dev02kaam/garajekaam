import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Clock3,
  Download,
  FileSpreadsheet,
  History,
  Image as ImageIcon,
  Library,
  LoaderCircle,
  MailOpen,
  Palette,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Upload,
  Workflow,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import marketingAgriculture from '../assets/marketing-agriculture-automation.webp'
import marketingCreativeStudio from '../assets/marketing-creative-studio.webp'
import marketingWinery from '../assets/marketing-winery-followup.webp'
import {
  workflowApi,
  type WorkflowCampaign,
  type WorkflowCampaignContact,
  type WorkflowConversation,
  type WorkflowConversationEmail,
  type WorkflowCreative,
  type WorkflowFollowupConversation,
} from '../workflowApi'

export type AgentId = 'prospecto' | 'bardo' | 'marketing' | 'bucle'

type DashboardModalProps = {
  agent: AgentId | null
  onClose: () => void
  csrfToken: string
}

type CsvSummary = {
  filename: string
  rows: number
  valid: number
  issues: number
  columns: string[]
}

type PromptHistoryItem = {
  id: string
  prompt: string
  filename: string
  createdAt: string
  status: 'pending' | 'sent' | 'failed'
  csvRows?: number
  csvValid?: number
}

type CampaignDeliveryIssue = {
  id: string
  company: string
  email: string
  segment: string
  reason: string
  attemptedAt: string
}

type CampaignHistoryItem = {
  id: string
  title: string
  filename: string
  createdAt: string
  csvRows: number | null
  csvValid: number | null
  prompt: string
  status: WorkflowCampaign['status']
  workflowStatus: string | null
  updatedAt: string | null
  completedAt: string | null
  lastError: WorkflowCampaign['lastError']
  execution: WorkflowCampaign['execution'] | null
  selectedCompanies: number | null
  companiesContacted: number | null
  replies: number | null
  interested: number | null
  days: Array<{ weekday: string; date: string; segment: string; window: string; contacted: number }>
  deliveryIssues: CampaignDeliveryIssue[]
  source: 'demo' | 'local' | 'database'
}

type CampaignContactFilter = 'all' | 'sent' | 'pending' | 'issues' | 'not-selected'
type CampaignContactDataState = 'idle' | 'loading' | 'ready' | 'error'

type WorkflowRun = {
  state: 'idle' | 'sending' | 'accepted' | 'completed' | 'failed'
  message: string
  updatedAt?: string
  executionId?: string
}

type BardoStepState = 'complete' | 'active' | 'waiting' | 'error'

type BardoWorkflowStep = {
  title: string
  detail: string
  state: BardoStepState
  moment: string
}

type BardoEmailStatus = 'completed' | 'failed' | 'active'

type BardoEmailRun = {
  id: string
  subject: string
  receivedAt: string
  duration: string
  status: BardoEmailStatus
  completedSteps: number
  summary: string
  incoming?: {
    fromEmail: string
    toEmail: string
    body: string
  }
  reply?: {
    id: string
    messageId: string
    subject: string
    sentAt: string
    status: string
    fromEmail: string
    toEmail: string
    body: string
  } | null
}

type BardoConversation = {
  id: string
  contact: string
  company: string
  email: string
  lastActivity: string
  emails: BardoEmailRun[]
}

type BucleConversationState = WorkflowFollowupConversation['state']

type BucleEvent = {
  id: string
  title: string
  at: string
  note: string
  type: 'bardo' | 'follow-up' | 'reply' | 'issue' | 'cancelled'
}

type BucleConversation = {
  id: string
  contact: string
  company: string
  email: string
  state: BucleConversationState
  lastBardoMessageAt: string
  eligibleAt: string | null
  nextFollowUpAt: string | null
  nextIn: string | null
  followUpCount: number
  events: BucleEvent[]
}

type MarketingAssetStatus = 'draft' | 'in-review' | 'approved'

type MarketingAsset = {
  id: string
  title: string
  prompt: string
  image: string
  createdAt: string
  status: MarketingAssetStatus
  referenceName?: string
}

type WorkflowDataState = 'loading' | 'postgres' | 'unavailable' | 'error'

const PROMPT_HISTORY_KEY = 'garaje-kaam-prospecting-prompts'
const demoCampaigns: CampaignHistoryItem[] = [
  {
    id: 'CMP-SECTORES-0821',
    title: 'Agricultura + bodegas · Semana 34',
    filename: 'directorio-empresas-espana.csv',
    createdAt: '2026-08-21T08:30:00',
    csvRows: 12480,
    csvValid: 11842,
    prompt: 'Para empresas del sector agrícola, envía el lunes y el martes entre las 09:00 y las 13:00. Para bodegas, reparte los envíos entre miércoles, jueves y viernes en la misma franja. Selecciona solo responsables comerciales y evita duplicados.',
    status: 'completed',
    workflowStatus: 'completed',
    updatedAt: '2026-08-21T13:00:00',
    completedAt: '2026-08-21T13:00:00',
    lastError: null,
    execution: null,
    selectedCompanies: 612,
    companiesContacted: 604,
    replies: 82,
    interested: 31,
    days: [
      { weekday: 'Lunes', date: '17 ago', segment: 'Agricultura', window: '09:00–13:00', contacted: 155 },
      { weekday: 'Martes', date: '18 ago', segment: 'Agricultura', window: '09:00–13:00', contacted: 151 },
      { weekday: 'Miércoles', date: '19 ago', segment: 'Bodegas', window: '09:00–13:00', contacted: 100 },
      { weekday: 'Jueves', date: '20 ago', segment: 'Bodegas', window: '09:00–13:00', contacted: 100 },
      { weekday: 'Viernes', date: '21 ago', segment: 'Bodegas', window: '09:00–13:00', contacted: 98 },
    ],
    deliveryIssues: [
      { id: 'INC-0821-01', company: 'Agroviña del Duero', email: 'contacto@agrovina.example', segment: 'Bodegas', reason: 'Buzón rechazado por el servidor (550)', attemptedAt: 'Mié 19 ago · 10:14' },
      { id: 'INC-0821-02', company: 'Campoverde SL', email: 'ventas@campoverde.example', segment: 'Agricultura', reason: 'Dominio no disponible tras 3 reintentos', attemptedAt: 'Lun 17 ago · 11:22' },
      { id: 'INC-0821-03', company: 'Bodegas Riofrío', email: 'comercial@riofrio.example', segment: 'Bodegas', reason: 'Dirección dada de baja', attemptedAt: 'Jue 20 ago · 09:48' },
      { id: 'INC-0821-04', company: 'Cultivos La Vega', email: 'info@cultivoslavega.example', segment: 'Agricultura', reason: 'Dirección duplicada en el CSV', attemptedAt: 'Mar 18 ago · 10:05' },
      { id: 'INC-0821-05', company: 'Viñedos Serrano', email: 'hola@vinedosserrano.example', segment: 'Bodegas', reason: 'Buzón inexistente (550)', attemptedAt: 'Vie 21 ago · 10:31' },
      { id: 'INC-0821-06', company: 'Agrícola Horizonte', email: 'comercial@agricolahorizonte.example', segment: 'Agricultura', reason: 'Servidor temporalmente inaccesible', attemptedAt: 'Mar 18 ago · 12:18' },
      { id: 'INC-0821-07', company: 'Celler Montclar', email: 'marketing@cellermontclar.example', segment: 'Bodegas', reason: 'Dominio sin registros MX', attemptedAt: 'Jue 20 ago · 11:07' },
      { id: 'INC-0821-08', company: 'Huerta San Telmo', email: 'contacto@huertasantelmo.example', segment: 'Agricultura', reason: 'Bloqueada por la lista de exclusión', attemptedAt: 'Lun 17 ago · 12:42' },
    ],
    source: 'demo',
  },
  {
    id: 'CMP-CREATIVOS-0815',
    title: 'Estudios creativos · España',
    filename: 'directorio-empresas-espana.csv',
    createdAt: '2026-08-15T09:15:00',
    csvRows: 12480,
    csvValid: 11842,
    prompt: 'Selecciona estudios creativos de menos de 30 personas. Envía la primera mitad el jueves por la mañana y el resto el viernes. Explica cómo pueden automatizar el seguimiento comercial sin perder su tono personal.',
    status: 'completed',
    workflowStatus: 'completed',
    updatedAt: '2026-08-15T12:30:00',
    completedAt: '2026-08-15T12:30:00',
    lastError: null,
    execution: null,
    selectedCompanies: 51,
    companiesContacted: 51,
    replies: 12,
    interested: 5,
    days: [
      { weekday: 'Jueves', date: '14 ago', segment: 'Estudios creativos', window: '09:30–12:30', contacted: 28 },
      { weekday: 'Viernes', date: '15 ago', segment: 'Estudios creativos', window: '09:30–12:30', contacted: 23 },
    ],
    deliveryIssues: [],
    source: 'demo',
  },
  {
    id: 'CMP-COMERCIO-0808',
    title: 'Comercio local · Automatización',
    filename: 'directorio-empresas-espana.csv',
    createdAt: '2026-08-08T08:05:00',
    csvRows: 12480,
    csvValid: 11842,
    prompt: 'Filtra comercios minoristas de la zona centro y reparte los envíos durante tres mañanas. Presenta una forma sencilla de reducir tareas manuales, evita tecnicismos y pregunta qué proceso les hace perder más tiempo.',
    status: 'completed',
    workflowStatus: 'completed',
    updatedAt: '2026-08-08T13:00:00',
    completedAt: '2026-08-08T13:00:00',
    lastError: null,
    execution: null,
    selectedCompanies: 93,
    companiesContacted: 87,
    replies: 8,
    interested: 2,
    days: [
      { weekday: 'Miércoles', date: '6 ago', segment: 'Comercio minorista', window: '10:00–13:00', contacted: 31 },
      { weekday: 'Jueves', date: '7 ago', segment: 'Comercio minorista', window: '10:00–13:00', contacted: 30 },
      { weekday: 'Viernes', date: '8 ago', segment: 'Comercio minorista', window: '10:00–13:00', contacted: 26 },
    ],
    deliveryIssues: [
      { id: 'INC-0808-01', company: 'Mercado del Prado', email: 'hola@mercadodelprado.example', segment: 'Comercio minorista', reason: 'Buzón inexistente (550)', attemptedAt: 'Mié 6 ago · 10:26' },
      { id: 'INC-0808-02', company: 'Casa Olmo', email: 'contacto@casaolmo.example', segment: 'Comercio minorista', reason: 'Dominio sin registros MX', attemptedAt: 'Mié 6 ago · 11:41' },
      { id: 'INC-0808-03', company: 'Almacenes Norte', email: 'ventas@almacenesnorte.example', segment: 'Comercio minorista', reason: 'Servidor temporalmente inaccesible', attemptedAt: 'Jue 7 ago · 10:18' },
      { id: 'INC-0808-04', company: 'Tienda Cobalto', email: 'equipo@tiendacobalto.example', segment: 'Comercio minorista', reason: 'Dirección duplicada en el CSV', attemptedAt: 'Jue 7 ago · 12:04' },
      { id: 'INC-0808-05', company: 'Bazar Alameda', email: 'info@bazaralameda.example', segment: 'Comercio minorista', reason: 'Bloqueada por la lista de exclusión', attemptedAt: 'Vie 8 ago · 10:52' },
      { id: 'INC-0808-06', company: 'Librería Mirador', email: 'correo@libreriamirador.example', segment: 'Comercio minorista', reason: 'Buzón rechazado por el servidor (550)', attemptedAt: 'Vie 8 ago · 12:11' },
    ],
    source: 'demo',
  },
]

const BARDO_STAGE_COPY = [
  { title: 'Respuesta detectada', detail: 'Correo entrante recibido' },
  { title: 'Interés validado', detail: 'Intención y prioridad clasificadas' },
  { title: 'Contexto reunido', detail: 'Conversación y campaña recuperadas' },
  { title: 'Réplica generada', detail: 'Respuesta automática redactada' },
  { title: 'Envío y registro', detail: 'Correo enviado y ejecución guardada' },
]

const bardoConversations: BardoConversation[] = [
  {
    id: 'CONV-NORA-VIDAL', contact: 'Nora Vidal', company: 'Ánfora Studio', email: 'nora@anforastudio.es', lastActivity: '24 ago · 10:42',
    emails: [
      { id: 'EXE-BARDO-1042', subject: 'Re: automatización de captación', receivedAt: '24 ago 2026 · 10:42', duration: 'En curso', status: 'active', completedSteps: 3, summary: 'El Bardo está redactando una respuesta con el contexto de los correos anteriores.' },
      { id: 'EXE-BARDO-1019', subject: 'Re: ejemplo para una campaña pequeña', receivedAt: '22 ago 2026 · 16:08', duration: '36 s', status: 'completed', completedSteps: 5, summary: 'La solicitud de ejemplo fue respondida y añadida al hilo.' },
      { id: 'EXE-BARDO-0997', subject: 'Re: propuesta de automatización', receivedAt: '20 ago 2026 · 11:24', duration: '34 s', status: 'completed', completedSteps: 5, summary: 'Primer correo interesado respondido y conversación creada.' },
    ],
  },
  {
    id: 'CONV-MATEO-RIOS', contact: 'Mateo Ríos', company: 'Ríos & Co.', email: 'mateo@riosyco.es', lastActivity: '24 ago · 10:31',
    emails: [
      { id: 'EXE-BARDO-1039', subject: 'Re: integración con el correo actual', receivedAt: '24 ago 2026 · 10:31', duration: '38 s', status: 'completed', completedSteps: 5, summary: 'Pregunta técnica respondida y conversación actualizada.' },
      { id: 'EXE-BARDO-1008', subject: 'Re: propuesta para el equipo', receivedAt: '21 ago 2026 · 13:52', duration: '33 s', status: 'completed', completedSteps: 5, summary: 'Interés inicial respondido y conversación creada.' },
    ],
  },
  {
    id: 'CONV-LINA-COSTA', contact: 'Lina Costa', company: 'Norte Verde', email: 'lina@norteverde.es', lastActivity: '24 ago · 09:58',
    emails: [
      { id: 'EXE-BARDO-1038', subject: 'Re: retomemos el próximo mes', receivedAt: '24 ago 2026 · 09:58', duration: '31 s', status: 'completed', completedSteps: 5, summary: 'Interés futuro registrado y respuesta enviada.' },
      { id: 'EXE-BARDO-1014', subject: 'Re: reducir trabajo manual', receivedAt: '22 ago 2026 · 09:12', duration: '35 s', status: 'completed', completedSteps: 5, summary: 'La consulta sobre automatización fue respondida.' },
      { id: 'EXE-BARDO-0986', subject: 'Consulta inicial', receivedAt: '19 ago 2026 · 17:40', duration: '29 s', status: 'completed', completedSteps: 5, summary: 'Conversación identificada y respuesta inicial enviada.' },
    ],
  },
  {
    id: 'CONV-AINA-REY', contact: 'Aina Rey', company: 'Taller Nómada', email: 'aina@tallernomada.es', lastActivity: '24 ago · 09:17',
    emails: [
      { id: 'EXE-BARDO-1037', subject: 'Re: disponibilidad esta semana', receivedAt: '24 ago 2026 · 09:17', duration: '42 s', status: 'completed', completedSteps: 5, summary: 'Disponibilidad respondida y conversación actualizada.' },
      { id: 'EXE-BARDO-1024', subject: 'Re: dudas sobre la prueba', receivedAt: '23 ago 2026 · 12:03', duration: '37 s', status: 'completed', completedSteps: 5, summary: 'Dudas de la prueba respondidas.' },
      { id: 'EXE-BARDO-1003', subject: 'Re: prueba de captación', receivedAt: '21 ago 2026 · 10:16', duration: '32 s', status: 'completed', completedSteps: 5, summary: 'Alcance de la prueba confirmado.' },
      { id: 'EXE-BARDO-0979', subject: 'Interés en la propuesta', receivedAt: '19 ago 2026 · 09:46', duration: '30 s', status: 'completed', completedSteps: 5, summary: 'Conversación creada y primer correo respondido.' },
    ],
  },
  {
    id: 'CONV-BRUNO-SANZ', contact: 'Bruno Sanz', company: 'Lumen Norte', email: 'bruno@lumennorte.es', lastActivity: '23 ago · 18:44',
    emails: [
      { id: 'EXE-BARDO-1036', subject: 'Re: confirmación de reunión', receivedAt: '23 ago 2026 · 18:44', duration: '27 s', status: 'failed', completedSteps: 4, summary: 'El servidor de correo rechazó la respuesta. Requiere revisión en n8n.' },
      { id: 'EXE-BARDO-1001', subject: 'Re: propuesta comercial', receivedAt: '21 ago 2026 · 09:38', duration: '34 s', status: 'completed', completedSteps: 5, summary: 'Interés inicial respondido y conversación creada.' },
    ],
  },
  {
    id: 'CONV-CLARA-NAVAS', contact: 'Clara Navas', company: 'Bruma Labs', email: 'clara@brumalabs.es', lastActivity: '23 ago · 17:12',
    emails: [
      { id: 'EXE-BARDO-1035', subject: 'Re: automatización del equipo', receivedAt: '23 ago 2026 · 17:12', duration: '35 s', status: 'completed', completedSteps: 5, summary: 'Respuesta enviada y conversación registrada.' },
    ],
  },
]

function readPromptHistory(): PromptHistoryItem[] {
  try {
    const saved = localStorage.getItem(PROMPT_HISTORY_KEY)
    return saved ? JSON.parse(saved).slice(0, 8) : []
  } catch {
    return []
  }
}

function formatMoment(value: string) {
  return new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatDateTime(value: string | null, fallback = 'Sin fecha') {
  if (!value) return fallback
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return fallback
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function formatCampaignDay(value: string) {
  const date = new Date(`${value}T12:00:00`)
  if (Number.isNaN(date.getTime())) return { weekday: value, date: value }
  return {
    weekday: new Intl.DateTimeFormat('es-ES', { weekday: 'long' }).format(date),
    date: new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' }).format(date),
  }
}

function relativeUntil(value: string | null) {
  if (!value) return null
  const milliseconds = new Date(value).getTime() - Date.now()
  if (!Number.isFinite(milliseconds)) return null
  if (milliseconds <= 0) return 'pendiente'
  const totalMinutes = Math.ceil(milliseconds / 60_000)
  const days = Math.floor(totalMinutes / 1_440)
  const hours = Math.floor((totalMinutes % 1_440) / 60)
  const minutes = totalMinutes % 60
  return days ? `${days} d ${hours} h` : hours ? `${hours} h ${minutes} min` : `${minutes} min`
}

function workflowDataLabel(state: WorkflowDataState) {
  if (state === 'postgres') return 'PostgreSQL · datos reales'
  if (state === 'loading') return 'Consultando PostgreSQL…'
  if (state === 'unavailable') return 'Módulo pendiente en PostgreSQL'
  return 'PostgreSQL no disponible'
}

function mapCampaign(campaign: WorkflowCampaign): CampaignHistoryItem {
  return {
    id: campaign.id,
    title: campaign.title,
    filename: campaign.filename,
    createdAt: campaign.createdAt,
    csvRows: campaign.csvRows,
    csvValid: campaign.csvValid,
    prompt: campaign.prompt,
    status: campaign.status,
    workflowStatus: campaign.workflowStatus,
    updatedAt: campaign.updatedAt,
    completedAt: campaign.completedAt,
    lastError: campaign.lastError,
    execution: campaign.execution,
    selectedCompanies: campaign.selectedCompanies,
    companiesContacted: campaign.companiesContacted,
    replies: campaign.replies,
    interested: campaign.interested,
    days: campaign.days.map((day) => ({ ...day, ...formatCampaignDay(day.date) })),
    deliveryIssues: campaign.deliveryIssues.map((issue) => ({
      ...issue,
      attemptedAt: formatDateTime(issue.attemptedAt),
    })),
    source: 'database',
  }
}

function mapBardoConversation(conversation: WorkflowConversation): BardoConversation {
  return {
    id: conversation.id,
    contact: conversation.contact,
    company: conversation.company,
    email: conversation.email,
    lastActivity: formatDateTime(conversation.lastActivity),
    emails: conversation.emails.map((email) => ({
      id: email.id,
      subject: email.subject,
      receivedAt: formatDateTime(email.receivedAt),
      duration: '—',
      status: email.status,
      completedSteps: email.status === 'completed' ? 5 : 3,
      summary: email.summary,
    })),
  }
}

function mapBucleConversation(conversation: WorkflowFollowupConversation): BucleConversation {
  const orderedEvents = [...conversation.events].sort((left, right) => (
    new Date(left.dueAt || left.sentAt || 0).getTime() - new Date(right.dueAt || right.sentAt || 0).getTime()
  ))
  const bardoDate = conversation.lastBardoMessageAt
  const events: BucleEvent[] = [
    ...(bardoDate ? [{
      id: `${conversation.id}-bardo`,
      title: 'Mensaje de El Bardo',
      at: bardoDate,
      note: 'Inicio de la espera semanal',
      type: 'bardo' as const,
    }] : []),
    ...orderedEvents.flatMap((event) => {
      const items: BucleEvent[] = []
      if (event.status === 'sent' && event.sentAt) items.push({
        id: `${event.id}-sent`,
        title: `Recontacto automático ${event.followUpNumber}`,
        at: event.sentAt,
        note: 'Envío confirmado',
        type: 'follow-up',
      })
      if (event.responseDetectedAt) items.push({
        id: `${event.id}-reply`,
        title: 'Respuesta recibida',
        at: event.responseDetectedAt,
        note: 'Seguimiento cerrado',
        type: 'reply',
      })
      if (event.status === 'cancelled') items.push({
        id: `${event.id}-cancelled`,
        title: `Recontacto ${event.followUpNumber} cancelado`,
        at: event.updatedAt || event.dueAt || '',
        note: bucleCancellationReason(event.cancellationReason),
        type: 'cancelled',
      })
      if (event.error || ['failed', 'delivery_unknown'].includes(event.status)) items.push({
        id: `${event.id}-issue`,
        title: event.status === 'delivery_unknown' ? 'Entrega sin confirmar' : event.status === 'pending' ? 'Reintento pendiente' : 'Fallo de seguimiento',
        at: event.updatedAt || event.dueAt || '',
        note: event.error?.message || (event.status === 'delivery_unknown' ? 'Requiere revisión antes de volver a enviar.' : 'No se ha confirmado ningún envío para este intento.'),
        type: 'issue',
      })
      return items
    }),
  ]
  if (conversation.responseDetectedAt && !orderedEvents.some((event) => event.responseDetectedAt === conversation.responseDetectedAt)) {
    events.push({ id: `${conversation.id}-reply`, title: 'Respuesta recibida', at: conversation.responseDetectedAt, note: 'Seguimiento cerrado', type: 'reply' })
  }

  return {
    id: conversation.id,
    contact: conversation.contact,
    company: conversation.company,
    email: conversation.email,
    state: conversation.state,
    lastBardoMessageAt: formatBucleDate(bardoDate),
    eligibleAt: conversation.eligibleAt,
    nextFollowUpAt: conversation.nextFollowUpAt,
    nextIn: relativeUntil(conversation.nextFollowUpAt),
    followUpCount: conversation.followUpCount,
    events: events.sort((a, b) => new Date(a.at || 0).getTime() - new Date(b.at || 0).getTime()),
  }
}

const bucleStateLabels: Record<BucleConversationState, string> = {
  waiting: 'En espera', generating: 'Preparando mensaje', sending: 'Enviando',
  replied: 'Respondió', closed: 'Seguimiento cerrado', failed: 'Falló', 'needs-review': 'Revisar entrega',
}

function formatBucleDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'No disponible'
  return new Intl.DateTimeFormat('es-ES', {
    timeZone: 'Europe/Madrid', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function bucleCancellationReason(reason: string | null) {
  const labels: Record<string, string> = {
    incoming_reply_detected: 'Se recibió una respuesta.', suppression_list: 'El contacto está dado de baja.',
    lead_do_not_contact: 'El contacto no admite nuevos mensajes.', automation_disabled: 'Automatización pausada.',
    conversation_not_eligible: 'La conversación ya no admite seguimiento.', newer_outgoing_message: 'Hay un mensaje posterior.',
    eligibility_changed: 'La conversación ya no cumple las condiciones de seguimiento.',
  }
  return labels[reason || ''] || 'Seguimiento cancelado sin envío.'
}

function mapMarketingAsset(asset: WorkflowCreative): MarketingAsset | null {
  if (!asset.image) return null
  let image: string
  try {
    const url = new URL(asset.image, window.location.origin)
    if (url.origin !== window.location.origin && url.protocol !== 'https:') return null
    image = url.href
  } catch {
    return null
  }
  const status: MarketingAssetStatus = asset.isActive || ['approved', 'active'].includes(asset.status)
    ? 'approved'
    : ['review_pending', 'in_review', 'review_requested'].includes(asset.status)
      ? 'in-review'
      : 'draft'
  return {
    id: asset.id,
    title: asset.title,
    prompt: asset.prompt,
    image,
    createdAt: formatDateTime(asset.createdAt),
    status,
  }
}

const demoMarketingAssets: MarketingAsset[] = [
  {
    id: 'VISUAL-AGRICULTURA-0824',
    title: 'Agricultura conectada',
    prompt: 'Un paisaje agrícola español al amanecer donde un cable naranja recorre los cultivos y se transforma en rutas de datos ordenadas. Editorial, cálido, profesional y sin texto.',
    image: marketingAgriculture,
    createdAt: '24 ago 2026 · 09:18',
    status: 'approved',
  },
  {
    id: 'VISUAL-BODEGAS-0823',
    title: 'Bodegas en seguimiento',
    prompt: 'Una bodega tradicional con barricas y una cinta burdeos que se convierte en señales de seguimiento teal. Elegante, atmosférico, sin personas ni texto.',
    image: marketingWinery,
    createdAt: '23 ago 2026 · 16:42',
    status: 'in-review',
    referenceName: 'bodega-referencia.jpg',
  },
  {
    id: 'VISUAL-ESTUDIO-0821',
    title: 'Estudio con más tiempo',
    prompt: 'Una mesa de estudio creativo con sobres artesanales conectados por un hilo naranja que atraviesa un temporizador y termina en una pieza gráfica terminada. Editorial y humano.',
    image: marketingCreativeStudio,
    createdAt: '21 ago 2026 · 11:06',
    status: 'draft',
  },
]

function ModalShell({ agent, onClose, children }: DashboardModalProps & { children: React.ReactNode }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const modalRef = useRef<HTMLElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!agent) return
    previousFocus.current = document.activeElement as HTMLElement
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getClientRects().length > 0)

      if (!focusable.length) {
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (event.shiftKey && (active === first || !modalRef.current?.contains(active))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.body.classList.add('modal-open')
    const pageScrollY = window.scrollY
    const previousBodyStyles = {
      position: document.body.style.position,
      top: document.body.style.top,
      right: document.body.style.right,
      left: document.body.style.left,
      width: document.body.style.width,
    }
    Object.assign(document.body.style, {
      position: 'fixed',
      top: `-${pageScrollY}px`,
      right: '0',
      left: '0',
      width: '100%',
    })
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.classList.remove('modal-open')
      Object.assign(document.body.style, previousBodyStyles)
      window.scrollTo(0, pageScrollY)
      window.removeEventListener('keydown', onKeyDown)
      previousFocus.current?.focus()
    }
  }, [agent, onClose])

  if (!agent) return null

  const labels: Record<AgentId, { name: string; title: string }> = {
    prospecto: { name: 'El Visionario', title: 'Lanzamientos' },
    bardo: { name: 'El Bardo', title: 'Proceso automático' },
    marketing: { name: 'Marketing', title: 'Taller creativo' },
    bucle: { name: 'Doc Bucle', title: 'Cadencia' },
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={modalRef}
        className="dashboard-modal"
        data-dashboard={agent}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dashboard-title"
      >
        <header className="dashboard-header">
          <div className="dashboard-heading">
            <span className="dashboard-persona">{labels[agent].name}</span>
            <h2 id="dashboard-title">{labels[agent].title}</h2>
          </div>
          <div className="dashboard-header-actions">
            <button ref={closeRef} className="icon-button" type="button" onClick={onClose} aria-label="Cerrar panel">
              <X aria-hidden="true" />
            </button>
          </div>
        </header>
        {children}
      </section>
    </div>
  )
}

function ProspectoDashboard({ csrfToken }: { csrfToken: string }) {
  const prepareTabRef = useRef<HTMLButtonElement>(null)
  const activityTabRef = useRef<HTMLButtonElement>(null)
  const campaignHistoryTabRef = useRef<HTMLButtonElement>(null)
  const [summary, setSummary] = useState<CsvSummary | null>(null)
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState('')
  const [history, setHistory] = useState<PromptHistoryItem[]>(readPromptHistory)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)
  const [activeTab, setActiveTab] = useState<'prepare' | 'activity' | 'history'>('prepare')
  const [campaignQuery, setCampaignQuery] = useState('')
  const [selectedCampaignId, setSelectedCampaignId] = useState(demoCampaigns[0].id)
  const [databaseCampaigns, setDatabaseCampaigns] = useState<CampaignHistoryItem[]>([])
  const [campaignDataState, setCampaignDataState] = useState<WorkflowDataState>('loading')
  const [campaignWebhookReady, setCampaignWebhookReady] = useState(false)
  const [campaignContacts, setCampaignContacts] = useState<WorkflowCampaignContact[]>([])
  const [campaignContactsTotal, setCampaignContactsTotal] = useState(0)
  const [campaignContactState, setCampaignContactState] = useState<CampaignContactDataState>('idle')
  const [campaignContactQuery, setCampaignContactQuery] = useState('')
  const [campaignContactFilter, setCampaignContactFilter] = useState<CampaignContactFilter>('all')
  const [campaignContactPage, setCampaignContactPage] = useState(0)
  const [run, setRun] = useState<WorkflowRun>({
    state: 'idle',
    message: 'Comprobando la conexión con n8n…',
  })

  useEffect(() => {
    localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(history))
  }, [history])

  useEffect(() => {
    let active = true
    workflowApi.config()
      .then((config) => {
        if (!active) return
        setCampaignWebhookReady(config.campaignWebhookConfigured)
        setRun((current) => current.state === 'idle' ? {
          ...current,
          message: config.campaignWebhookConfigured
            ? 'Preparado para recibir una campaña.'
            : 'Webhook de campañas de n8n pendiente de configurar.',
        } : current)
      })
      .catch(() => {
        if (!active) return
        setRun((current) => current.state === 'idle' ? { ...current, message: 'No se pudo comprobar la conexión con n8n.' } : current)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    let refreshing = false

    const loadCampaigns = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const result = await workflowApi.campaigns(200)
        if (!active) return
        const mapped = result.campaigns.map(mapCampaign)
        setDatabaseCampaigns(mapped)
        setCampaignDataState(result.available ? 'postgres' : 'unavailable')
        if (mapped[0]) {
          setSelectedCampaignId((current) => (
            mapped.some((campaign) => campaign.id === current) ? current : mapped[0].id
          ))
        }
      } catch {
        if (active) setCampaignDataState('error')
      } finally {
        refreshing = false
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadCampaigns()
    }

    void loadCampaigns()
    const timer = window.setInterval(refreshWhenVisible, 15_000)
    window.addEventListener('focus', refreshWhenVisible)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener('focus', refreshWhenVisible)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
    }
  }, [])

  const readCsv = (file?: File) => {
    setError('')
    setRun({
      state: 'idle',
      message: campaignWebhookReady ? 'Preparado para recibir una campaña.' : 'Webhook de campañas de n8n pendiente de configurar.',
    })
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvFile(null)
      setSummary(null)
      setError('Ese archivo no es un CSV. Exporta tu lista como .csv y vuelve a intentarlo.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setCsvFile(null)
      setSummary(null)
      setError('El CSV supera 10 MB. Divide la lista en varios archivos antes de enviarla.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '').trim()
      const lines = text.split(/\r?\n/).filter(Boolean)
      if (lines.length < 2) {
        setCsvFile(null)
        setSummary(null)
        setError('El CSV no contiene contactos. Incluye una cabecera y al menos una fila.')
        return
      }
      const separator = lines[0].includes(';') ? ';' : ','
      const columns = lines[0].split(separator).map((column) => column.trim().replace(/^"|"$/g, ''))
      const emailIndex = columns.findIndex((column) => /email|correo/i.test(column))
      const rows = lines.slice(1)
      const valid = rows.filter((line) => {
        const cells = line.split(separator)
        const candidate = emailIndex >= 0 ? cells[emailIndex] : line
        return /[^\s@]+@[^\s@]+\.[^\s@]+/.test(candidate)
      }).length
      setCsvFile(file)
      setSummary({ filename: file.name, rows: rows.length, valid, issues: rows.length - valid, columns })
    }
    reader.onerror = () => {
      setCsvFile(null)
      setSummary(null)
      setError('No hemos podido leer el archivo. Comprueba que no esté dañado.')
    }
    reader.readAsText(file)
  }

  const removeCsv = () => {
    setCsvFile(null)
    setSummary(null)
    setError('')
    setRun({
      state: 'idle',
      message: campaignWebhookReady ? 'Preparado para recibir una campaña.' : 'Webhook de campañas de n8n pendiente de configurar.',
    })
  }

  const updateHistoryStatus = (id: string, status: PromptHistoryItem['status']) => {
    setHistory((items) => items.map((item) => item.id === id ? { ...item, status } : item))
  }

  const launchWorkflow = async () => {
    const cleanPrompt = prompt.trim()
    if (!csvFile || !summary || summary.valid === 0 || !cleanPrompt) return

    const historyId = `${Date.now()}-${csvFile.name}`
    const createdAt = new Date().toISOString()
    const historyItem: PromptHistoryItem = {
      id: historyId,
      prompt: cleanPrompt,
      filename: csvFile.name,
      createdAt,
      status: 'pending',
      csvRows: summary.rows,
      csvValid: summary.valid,
    }
    setHistory((items) => [historyItem, ...items].slice(0, 8))
    setError('')
    setActiveTab('activity')

    if (!campaignWebhookReady) {
      updateHistoryStatus(historyId, 'failed')
      setRun({
        state: 'failed',
        message: 'El webhook de n8n todavía no está conectado.',
        updatedAt: createdAt,
      })
      return
    }

    setRun({ state: 'sending', message: 'Enviando CSV e instrucción a n8n…', updatedAt: createdAt })

    try {
      const body = new FormData()
      body.append('csv', csvFile, csvFile.name)
      body.append('prompt', cleanPrompt)
      body.append('source', 'garaje-kaam')
      body.append('validContacts', String(summary.valid))

      const payload = await workflowApi.launchCampaign(body, csrfToken)
      const data = payload
      const remoteMessage = typeof data?.message === 'string'
        ? data.message
        : 'n8n ha recibido la campaña.'

      const remoteStatus = String(data?.status ?? data?.state ?? 'accepted').toLowerCase()
      const completed = ['complete', 'completed', 'finished', 'success', 'succeeded'].includes(remoteStatus)
      const executionId = data?.executionId ?? data?.execution_id ?? data?.id
      updateHistoryStatus(historyId, 'sent')
      setRun({
        state: completed ? 'completed' : 'accepted',
        message: remoteMessage,
        updatedAt: new Date().toISOString(),
        executionId: executionId == null ? undefined : String(executionId),
      })
    } catch (requestError) {
      const message = requestError instanceof Error
          ? requestError.message
          : 'No se pudo contactar con n8n.'
      updateHistoryStatus(historyId, 'failed')
      setRun({ state: 'failed', message, updatedAt: new Date().toISOString() })
    }
  }

  const hasPrompt = prompt.trim().length > 0
  const canLaunch = Boolean(csvFile && summary && summary.valid > 0 && hasPrompt && run.state !== 'sending')
  const n8nStepState = run.state === 'sending'
    ? 'active'
    : run.state === 'accepted' || run.state === 'completed'
      ? 'complete'
      : run.state === 'failed'
        ? 'error'
        : 'waiting'
  const workflowStepState = run.state === 'completed'
    ? 'complete'
    : run.state === 'accepted'
      ? 'active'
      : run.state === 'failed'
        ? 'error'
        : 'waiting'

  const localCampaigns: CampaignHistoryItem[] = history.map((item) => ({
    id: item.id,
    title: item.filename.replace(/\.csv$/i, '').replace(/[-_]+/g, ' '),
    filename: item.filename,
    createdAt: item.createdAt,
    csvRows: item.csvRows ?? null,
    csvValid: item.csvValid ?? null,
    prompt: item.prompt,
    status: item.status === 'pending' ? 'running' : item.status === 'failed' ? 'failed' : 'pending-data',
    workflowStatus: null,
    updatedAt: item.createdAt,
    completedAt: null,
    lastError: null,
    execution: null,
    selectedCompanies: null,
    companiesContacted: null,
    replies: null,
    interested: null,
    days: [],
    deliveryIssues: [],
    source: 'local',
  }))
  const unresolvedLocalCampaigns = localCampaigns.filter((localCampaign) => !databaseCampaigns.some((databaseCampaign) => {
    const sameFile = localCampaign.filename.trim().toLocaleLowerCase('es') === databaseCampaign.filename.trim().toLocaleLowerCase('es')
    const samePrompt = localCampaign.prompt.trim() === databaseCampaign.prompt.trim()
    const launchDistance = Math.abs(new Date(localCampaign.createdAt).getTime() - new Date(databaseCampaign.createdAt).getTime())
    return sameFile && samePrompt && launchDistance <= 30 * 60_000
  }))
  const campaigns = [
    ...unresolvedLocalCampaigns,
    ...(campaignDataState === 'postgres' ? databaseCampaigns : demoCampaigns),
  ]
  const normalizedCampaignQuery = campaignQuery.trim().toLocaleLowerCase('es')
  const filteredCampaigns = campaigns.filter((campaign) => (
    `${campaign.title} ${campaign.filename} ${campaign.prompt} ${campaign.id} ${campaign.workflowStatus ?? ''} ${campaign.lastError?.code ?? ''} ${campaign.lastError?.message ?? ''} ${formatMoment(campaign.createdAt)} ${campaign.deliveryIssues.map((issue) => `${issue.company} ${issue.email} ${issue.segment} ${issue.reason}`).join(' ')}`
      .toLocaleLowerCase('es')
      .includes(normalizedCampaignQuery)
  ))
  const selectedCampaign = filteredCampaigns.find((campaign) => campaign.id === selectedCampaignId)
    ?? filteredCampaigns[0]
    ?? null
  const selectedCampaignDatabaseId = selectedCampaign?.source === 'database' ? selectedCampaign.id : null

  useEffect(() => {
    setCampaignContactPage(0)
  }, [selectedCampaignDatabaseId])

  useEffect(() => {
    let active = true
    if (activeTab !== 'history' || !selectedCampaignDatabaseId) {
      setCampaignContacts([])
      setCampaignContactsTotal(0)
      setCampaignContactState('idle')
      return () => { active = false }
    }

    setCampaignContactState('loading')
    const timer = window.setTimeout(() => {
      workflowApi.campaignContacts(selectedCampaignDatabaseId, {
        limit: 50,
        offset: campaignContactPage * 50,
        query: campaignContactQuery.trim(),
        status: campaignContactFilter,
      })
        .then((result) => {
          if (!active) return
          setCampaignContacts(result.contacts)
          setCampaignContactsTotal(result.total)
          setCampaignContactState('ready')
        })
        .catch(() => {
          if (!active) return
          setCampaignContacts([])
          setCampaignContactsTotal(0)
          setCampaignContactState('error')
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [activeTab, campaignContactFilter, campaignContactPage, campaignContactQuery, selectedCampaignDatabaseId])

  const campaignStatusLabels: Record<CampaignHistoryItem['status'], string> = {
    completed: 'Finalizada',
    partial: 'Finalizada con incidencias',
    running: 'En curso',
    'needs-review': 'Requiere revisión',
    cancelled: 'Cancelada',
    queued: 'En cola',
    paused: 'Pausada',
    failed: 'Incidencia',
    'pending-data': 'Pendiente de n8n',
  }

  const campaignContactStatusLabels: Record<string, string> = {
    pending_segmentation: 'Pendiente de segmentar',
    segmenting: 'Segmentando',
    not_selected: 'No seleccionada',
    scheduled: 'Programada',
    sending: 'Enviando',
    sent: 'Enviado',
    suppressed: 'Excluida',
    capacity_exhausted: 'Sin capacidad',
    delivery_unknown: 'Entrega sin confirmar',
    failed: 'Fallido',
  }
  const selectedExecution = selectedCampaign?.execution
  const selectedIssueCount = selectedExecution
    ? selectedExecution.suppressed + selectedExecution.capacityExhausted + selectedExecution.deliveryUnknown + selectedExecution.failed
    : selectedCampaign?.deliveryIssues.length ?? 0
  const selectedPendingCount = selectedExecution
    ? selectedExecution.pendingSegmentation + selectedExecution.segmenting + selectedExecution.scheduled + selectedExecution.sending
    : 0
  const campaignContactFilterCounts: Record<CampaignContactFilter, number | null> = {
    all: selectedCampaign?.csvValid ?? null,
    sent: selectedExecution?.sent ?? selectedCampaign?.companiesContacted ?? null,
    pending: selectedExecution ? selectedPendingCount : null,
    issues: selectedExecution ? selectedIssueCount : selectedCampaign?.deliveryIssues.length ?? null,
    'not-selected': selectedExecution?.notSelected ?? null,
  }

  const campaignRate = (value: number | null, total: number | null) => (
    value !== null && total ? `${Math.round((value / total) * 100)}%` : '—'
  )
  const formatCampaignCount = (value: number | null) => (
    value === null ? '—' : new Intl.NumberFormat('es-ES').format(value)
  )
  const campaignUncontacted = (campaign: CampaignHistoryItem) => (
    campaign.selectedCompanies !== null && campaign.companiesContacted !== null
      ? Math.max(campaign.selectedCompanies - campaign.companiesContacted, 0)
      : null
  )

  const moveTabFocus = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const tabs = ['prepare', 'activity', 'history'] as const
    const currentIndex = tabs.indexOf(activeTab)
    const nextIndex = event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? tabs.length - 1
        : event.key === 'ArrowLeft'
          ? (currentIndex - 1 + tabs.length) % tabs.length
          : (currentIndex + 1) % tabs.length
    const nextTab = tabs[nextIndex]
    setActiveTab(nextTab)
    const refs = { prepare: prepareTabRef, activity: activityTabRef, history: campaignHistoryTabRef }
    window.requestAnimationFrame(() => refs[nextTab].current?.focus())
  }

  return (
    <div className="dashboard-body prospecto-control-room">
      <div className="prospecto-tabs" role="tablist" aria-label="Secciones de campaña">
        <button
          ref={prepareTabRef}
          id="prepare-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'prepare'}
          aria-controls="prepare-panel"
          tabIndex={activeTab === 'prepare' ? 0 : -1}
          onClick={() => setActiveTab('prepare')}
          onKeyDown={moveTabFocus}
        >
          <FileSpreadsheet aria-hidden="true" /> Preparar
        </button>
        <button
          ref={activityTabRef}
          id="activity-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'activity'}
          aria-controls="activity-panel"
          tabIndex={activeTab === 'activity' ? 0 : -1}
          onClick={() => setActiveTab('activity')}
          onKeyDown={moveTabFocus}
        >
          <Activity aria-hidden="true" /> Actividad
          {run.state !== 'idle' && <span className={`tab-state is-${run.state}`} aria-hidden="true" />}
        </button>
        <button
          ref={campaignHistoryTabRef}
          id="campaign-history-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          aria-controls="campaign-history-panel"
          tabIndex={activeTab === 'history' ? 0 : -1}
          onClick={() => setActiveTab('history')}
          onKeyDown={moveTabFocus}
        >
          <History aria-hidden="true" /> Campañas
        </button>
      </div>

      {activeTab === 'prepare' && <main id="prepare-panel" className="campaign-builder" role="tabpanel" aria-labelledby="prepare-tab">
        <section className="campaign-input-section" aria-labelledby="csv-section-title">
          <div className="campaign-section-heading">
            <div><FileSpreadsheet aria-hidden="true" /><h3 id="csv-section-title">Lista de contactos</h3></div>
            {summary && <button className="text-action" type="button" onClick={removeCsv}><X /> Quitar</button>}
          </div>

          {!summary ? (
            <label
              className={`campaign-drop-zone ${dragging ? 'is-dragging' : ''}`}
              onDragEnter={() => setDragging(true)}
              onDragLeave={() => setDragging(false)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault()
                setDragging(false)
                readCsv(event.dataTransfer.files[0])
              }}
            >
              <input type="file" accept=".csv,text/csv" onChange={(event) => readCsv(event.target.files?.[0])} />
              <Upload aria-hidden="true" />
              <span><strong>Suelta el CSV</strong><small>o selecciónalo · máximo 10 MB</small></span>
            </label>
          ) : (
            <div className="campaign-file" aria-live="polite">
              <div className="campaign-file-name"><FileSpreadsheet /><span><strong>{summary.filename}</strong><small>{summary.columns.join(' · ')}</small></span></div>
              <div className="campaign-file-stats">
                <span><strong>{summary.rows}</strong> filas</span>
                <span><strong>{summary.valid}</strong> contactos</span>
                <span className={summary.issues ? 'has-issues' : ''}><strong>{summary.issues}</strong> revisar</span>
              </div>
            </div>
          )}

          {error && <div className="form-message error" role="alert"><AlertTriangle /> {error}</div>}
        </section>

        <section className="campaign-input-section prompt-section" aria-labelledby="prompt-section-title">
          <div className="campaign-section-heading">
            <div><Workflow aria-hidden="true" /><h3 id="prompt-section-title">Instrucción</h3></div>
            <span className="prompt-count">{prompt.length}/1200</span>
          </div>
          <textarea
            className="campaign-prompt"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, 1200))}
            rows={5}
            placeholder="Ej. Agricultura el lunes y martes; bodegas el miércoles, jueves y viernes, siempre de 09:00 a 13:00…"
          />
          <button className="primary-action launch-campaign" type="button" disabled={!canLaunch} onClick={launchWorkflow}>
            {run.state === 'sending' ? <><LoaderCircle className="spin" /> Enviando a n8n</> : <><Send /> Lanzar campaña</>}
          </button>
        </section>

      </main>}

      {activeTab === 'activity' && (
        <section id="activity-panel" className="activity-panel" role="tabpanel" aria-labelledby="activity-tab">

      <aside className="workflow-monitor" aria-labelledby="workflow-monitor-title" aria-live="polite">
        <div className="monitor-heading">
          <div><Activity aria-hidden="true" /><h3 id="workflow-monitor-title">Tareas del workflow</h3></div>
          <span className={`run-status is-${run.state}`}>{run.state === 'sending' ? 'En curso' : run.state === 'accepted' ? 'Aceptada' : run.state === 'completed' ? 'Finalizada' : run.state === 'failed' ? 'Incidencia' : 'En espera'}</span>
        </div>

        <div className={`run-callout is-${run.state}`}>
          <span className="run-light" />
          <div><strong>{run.state === 'idle' ? 'Listo para preparar' : run.state === 'sending' ? 'Conectando con n8n' : run.state === 'accepted' ? 'Workflow arrancado' : run.state === 'completed' ? 'Trabajo finalizado' : 'No se ha podido iniciar'}</strong><p>{run.message}</p></div>
        </div>

        <ol className="workflow-steps">
          <li data-state={summary && summary.valid > 0 ? 'complete' : 'waiting'}>
            <span className="step-mark">{summary && summary.valid > 0 ? <Check /> : '1'}</span>
            <div><strong>CSV preparado</strong><small>{summary ? `${summary.valid} contactos válidos` : 'Pendiente de archivo'}</small></div>
          </li>
          <li data-state={hasPrompt ? 'complete' : 'waiting'}>
            <span className="step-mark">{hasPrompt ? <Check /> : '2'}</span>
            <div><strong>Instrucción lista</strong><small>{hasPrompt ? `${prompt.trim().length} caracteres` : 'Pendiente de prompt'}</small></div>
          </li>
          <li data-state={n8nStepState}>
            <span className="step-mark">{n8nStepState === 'complete' ? <Check /> : n8nStepState === 'active' ? <LoaderCircle className="spin" /> : n8nStepState === 'error' ? '!' : '3'}</span>
            <div><strong>Recepción en n8n</strong><small>{run.state === 'sending' ? 'Subiendo datos' : run.state === 'accepted' || run.state === 'completed' ? 'Entrega confirmada' : run.state === 'failed' ? 'Requiere atención' : 'Sin iniciar'}</small></div>
          </li>
          <li data-state={workflowStepState}>
            <span className="step-mark">{workflowStepState === 'complete' ? <Check /> : workflowStepState === 'active' ? <Activity /> : workflowStepState === 'error' ? '!' : '4'}</span>
            <div><strong>Workflow</strong><small>{run.state === 'completed' ? 'Finalizado por n8n' : run.state === 'accepted' ? 'Procesando en n8n' : 'Esperando confirmación'}</small></div>
          </li>
        </ol>

        {run.executionId && <p className="execution-id"><span>ID de ejecución</span><strong>{run.executionId}</strong></p>}
        {run.updatedAt && <time className="monitor-time" dateTime={run.updatedAt}>Actualizado {formatMoment(run.updatedAt)}</time>}
      </aside>
        </section>
      )}

      {activeTab === 'history' && (
        <section id="campaign-history-panel" className="campaign-history-panel" role="tabpanel" aria-labelledby="campaign-history-tab">
          <header className="campaign-history-heading">
            <div>
              <h3>Historial de campañas</h3>
              <p>Consulta cómo terminó cada campaña, qué se envió y qué contactos quedaron pendientes o con incidencia.</p>
            </div>
          </header>

          <label className="campaign-history-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Buscar campañas</span>
            <input
              type="search"
              value={campaignQuery}
              onChange={(event) => setCampaignQuery(event.target.value)}
              placeholder="Buscar campaña, CSV, estado o incidencia"
            />
          </label>

          <div className="campaign-history-layout">
            <section className="campaign-history-index" aria-label="Campañas encontradas">
              <div className="campaign-history-count">
                <strong>{filteredCampaigns.length}</strong>
                <span>{filteredCampaigns.length === 1 ? 'campaña' : 'campañas'}</span>
              </div>
              {filteredCampaigns.length ? (
                <ul>
                  {filteredCampaigns.map((campaign) => (
                    <li key={campaign.id}>
                      <button
                        type="button"
                        className={selectedCampaign?.id === campaign.id ? 'is-selected' : ''}
                        aria-pressed={selectedCampaign?.id === campaign.id}
                        onClick={() => {
                          setSelectedCampaignId(campaign.id)
                          setCampaignContactQuery('')
                          setCampaignContactFilter('all')
                          setCampaignContactPage(0)
                        }}
                      >
                        <span className="campaign-index-copy">
                          <strong>{campaign.title}</strong>
                          <small>{campaign.filename}</small>
                        </span>
                        <span className="campaign-index-meta">
                          <time dateTime={campaign.createdAt}>{formatMoment(campaign.createdAt)}</time>
                          <span data-status={campaign.status}>{campaignStatusLabels[campaign.status]}</span>
                        </span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="campaign-history-empty">
                  <Search aria-hidden="true" />
                  <strong>Sin coincidencias</strong>
                  <span>Prueba con el nombre del CSV o una palabra de la instrucción.</span>
                </div>
              )}
            </section>

            {selectedCampaign && (
              <article className="campaign-history-detail" aria-live="polite">
                <header className="campaign-detail-heading">
                  <div>
                    <span className="campaign-detail-date">Lanzada {formatMoment(selectedCampaign.createdAt)}</span>
                    <h4>{selectedCampaign.title}</h4>
                  </div>
                  <div className="campaign-detail-labels">
                    {selectedCampaign.source === 'demo' && <span className="demo-label">Datos de demostración</span>}
                    {selectedCampaign.source === 'database' && <span className="demo-label">PostgreSQL · datos reales</span>}
                    <span className="campaign-status-label" data-status={selectedCampaign.status}>{campaignStatusLabels[selectedCampaign.status]}</span>
                  </div>
                </header>

                {selectedCampaign.source === 'database' && (
                  <section className="campaign-execution-summary" data-status={selectedCampaign.status} aria-label="Estado de ejecución de la campaña">
                    <div className="campaign-execution-state">
                      {selectedCampaign.status === 'completed'
                        ? <Check aria-hidden="true" />
                        : ['partial', 'needs-review', 'failed', 'cancelled'].includes(selectedCampaign.status)
                          ? <AlertTriangle aria-hidden="true" />
                          : <LoaderCircle aria-hidden="true" />}
                      <span>
                        <small>Resultado del workflow</small>
                        <strong>{campaignStatusLabels[selectedCampaign.status]}</strong>
                        <time dateTime={selectedCampaign.completedAt ?? selectedCampaign.updatedAt ?? selectedCampaign.createdAt}>
                          {selectedCampaign.completedAt
                            ? `Terminó ${formatDateTime(selectedCampaign.completedAt)}`
                            : `Actualizado ${formatDateTime(selectedCampaign.updatedAt, 'sin actualización registrada')}`}
                        </time>
                      </span>
                    </div>
                    <dl>
                      <div><dt>Enviados</dt><dd>{formatCampaignCount(selectedExecution?.sent ?? selectedCampaign.companiesContacted)}</dd></div>
                      <div><dt>Pendientes</dt><dd>{formatCampaignCount(selectedExecution ? selectedPendingCount : null)}</dd></div>
                      <div><dt>Incidencias</dt><dd>{formatCampaignCount(selectedExecution ? selectedIssueCount : selectedCampaign.deliveryIssues.length)}</dd></div>
                      <div><dt>No seleccionadas</dt><dd>{formatCampaignCount(selectedExecution?.notSelected ?? null)}</dd></div>
                    </dl>
                    {selectedCampaign.lastError && (
                      <div className="campaign-execution-error" role="status">
                        <strong>{selectedCampaign.lastError.code || 'Incidencia registrada'}</strong>
                        <span>{selectedCampaign.lastError.message || 'n8n marcó esta campaña para revisión.'}</span>
                      </div>
                    )}
                  </section>
                )}

                <div className="campaign-performance" aria-label="Resultados de la campaña">
                  <div>
                    <span>Seleccionadas por el prompt</span>
                    <strong>{formatCampaignCount(selectedCampaign.selectedCompanies)}</strong>
                    <small>{selectedCampaign.csvRows !== null && selectedCampaign.selectedCompanies !== null ? `de ${formatCampaignCount(selectedCampaign.csvRows)} empresas del CSV` : 'Selección pendiente'}</small>
                  </div>
                  <div>
                    <span>Empresas contactadas</span>
                    <strong>{formatCampaignCount(selectedCampaign.companiesContacted)}</strong>
                    <small>{campaignRate(selectedCampaign.companiesContacted, selectedCampaign.selectedCompanies)} de las seleccionadas</small>
                  </div>
                  <div data-metric="issues">
                    <span>Sin contactar</span>
                    <strong>{formatCampaignCount(campaignUncontacted(selectedCampaign))}</strong>
                    <small>
                      {campaignUncontacted(selectedCampaign) === null
                        ? 'Resultado pendiente'
                        : selectedCampaign.deliveryIssues.length
                          ? `${selectedCampaign.deliveryIssues.length} incidencias registradas`
                          : campaignUncontacted(selectedCampaign) === 0
                            ? 'Sin incidencias'
                            : 'Causas pendientes'}
                    </small>
                  </div>
                  <div>
                    <span>Respondieron</span>
                    <strong>{formatCampaignCount(selectedCampaign.replies)}</strong>
                    <small>{campaignRate(selectedCampaign.replies, selectedCampaign.companiesContacted)} de las contactadas</small>
                  </div>
                  <div>
                    <span>Interesadas</span>
                    <strong>{formatCampaignCount(selectedCampaign.interested)}</strong>
                    <small>{campaignRate(selectedCampaign.interested, selectedCampaign.companiesContacted)} de las contactadas</small>
                  </div>
                </div>

                {selectedCampaign.deliveryIssues.length > 0 && (
                  <details className="campaign-delivery-issues">
                    <summary>
                      <span><AlertTriangle aria-hidden="true" /><strong>{selectedCampaign.deliveryIssues.length} empresas sin contactar</strong></span>
                      <span>Ver causas</span>
                    </summary>
                    <div className="campaign-issues-body">
                      <p>Fueron seleccionadas por la instrucción, pero el correo no llegó a enviarse y no cuentan como contactadas.</p>
                      <ul aria-label="Incidencias de entrega">
                        {selectedCampaign.deliveryIssues.map((issue) => (
                          <li key={issue.id}>
                            <span className="campaign-issue-company">
                              <strong>{issue.company}</strong>
                              <small>{issue.email}</small>
                            </span>
                            <span className="campaign-issue-segment">{issue.segment}</span>
                            <span className="campaign-issue-reason">
                              <strong>{issue.reason}</strong>
                              <small>{issue.attemptedAt}</small>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {selectedCampaign.source === 'demo' && <small className="campaign-issues-note">{workflowDataLabel(campaignDataState)} · se muestra una campaña de ejemplo hasta desplegar el módulo.</small>}
                    </div>
                  </details>
                )}

                {selectedCampaign.source === 'database' && (
                  <section className="campaign-contact-ledger" aria-labelledby="campaign-contacts-title">
                    <header>
                      <div>
                        <h5 id="campaign-contacts-title">Destinatarios y correos</h5>
                        <p>Comprueba quién recibió el correo, quién quedó pendiente y el motivo de cada incidencia.</p>
                      </div>
                      <strong>{campaignContactsTotal} resultados</strong>
                    </header>

                    <div className="campaign-contact-tools">
                      <label>
                        <Search aria-hidden="true" />
                        <span className="sr-only">Buscar dentro de esta campaña</span>
                        <input
                          type="search"
                          value={campaignContactQuery}
                          onChange={(event) => {
                            setCampaignContactQuery(event.target.value)
                            setCampaignContactPage(0)
                          }}
                          placeholder="Empresa, correo, asunto o error"
                        />
                      </label>
                      <div className="campaign-contact-filters" aria-label="Filtrar destinatarios">
                        {([
                          ['all', 'Todos'],
                          ['sent', 'Enviados'],
                          ['pending', 'Pendientes'],
                          ['issues', 'Incidencias'],
                          ['not-selected', 'No seleccionados'],
                        ] as Array<[CampaignContactFilter, string]>).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            className={campaignContactFilter === value ? 'is-active' : ''}
                            aria-pressed={campaignContactFilter === value}
                            onClick={() => {
                              setCampaignContactFilter(value)
                              setCampaignContactPage(0)
                            }}
                          >
                            {label}
                            {campaignContactFilterCounts[value] !== null && <span>{campaignContactFilterCounts[value]}</span>}
                          </button>
                        ))}
                      </div>
                    </div>

                    {campaignContactState === 'loading' && (
                      <div className="campaign-contact-message"><LoaderCircle aria-hidden="true" /> Consultando PostgreSQL…</div>
                    )}
                    {campaignContactState === 'error' && (
                      <div className="campaign-contact-message is-error"><AlertTriangle aria-hidden="true" /> No se pudo cargar el detalle de los destinatarios.</div>
                    )}
                    {campaignContactState === 'ready' && campaignContacts.length === 0 && (
                      <div className="campaign-contact-message">No hay contactos que coincidan con este filtro.</div>
                    )}

                    {campaignContacts.length > 0 && (
                      <div className="campaign-contact-list">
                        {campaignContacts.map((contact) => {
                          const contactMoment = contact.sentAt ?? contact.attemptedAt ?? contact.scheduledAt ?? contact.nextAttemptAt
                          const contactStatusLabel = campaignContactStatusLabels[contact.status] || contact.status
                          return (
                            <details key={contact.id} className="campaign-contact-item" data-status={contact.status}>
                              <summary>
                                <span className="campaign-contact-person">
                                  <strong>{contact.company}</strong>
                                  <small>{contact.email}</small>
                                </span>
                                <span className="campaign-contact-subject">
                                  <strong>{contact.emailContent?.subject || contact.matchReason || 'Sin correo generado'}</strong>
                                  <small>{contact.segment || 'Sin segmento'}</small>
                                </span>
                                <span className="campaign-contact-result" data-status={contact.status}>{contactStatusLabel}</span>
                                <time dateTime={contactMoment ?? undefined}>{formatDateTime(contactMoment, 'Sin fecha')}</time>
                                <ArrowRight aria-hidden="true" />
                              </summary>
                              <div className="campaign-contact-detail">
                                <dl>
                                  <div><dt>Intentos</dt><dd>{contact.sendAttemptCount}</dd></div>
                                  <div><dt>Programado</dt><dd>{formatDateTime(contact.scheduledAt, 'No programado')}</dd></div>
                                  <div><dt>Enviado</dt><dd>{formatDateTime(contact.sentAt, 'No enviado')}</dd></div>
                                  <div><dt>ID proveedor</dt><dd>{contact.providerMessageId || 'No disponible'}</dd></div>
                                </dl>

                                {contact.error && (
                                  <div className="campaign-contact-error">
                                    <AlertTriangle aria-hidden="true" />
                                    <span><strong>{contact.error.code || 'Incidencia'}</strong>{contact.error.message || 'El workflow no registró más detalle.'}</span>
                                  </div>
                                )}

                                {contact.emailContent ? (
                                  <article className="campaign-email-preview">
                                    <header>
                                      <span>{contact.status === 'sent' ? 'Correo enviado' : 'Correo preparado'}</span>
                                      <strong>{contact.emailContent.subject}</strong>
                                      <small>Para: {contact.email}</small>
                                    </header>
                                    <div>
                                      {contact.emailContent.opening && <p>{contact.emailContent.opening}</p>}
                                      {contact.emailContent.cta && <p className="campaign-email-cta">{contact.emailContent.cta}</p>}
                                    </div>
                                  </article>
                                ) : (
                                  <p className="campaign-email-empty">No se llegó a generar contenido para este contacto.</p>
                                )}

                                {contact.reply && (
                                  <div className="campaign-contact-reply">
                                    <MailOpen aria-hidden="true" />
                                    <span>
                                      <strong>Respondió: {contact.reply.subject}</strong>
                                      <small>{formatDateTime(contact.reply.receivedAt)}{contact.reply.classification ? ` · ${contact.reply.classification}` : ''}</small>
                                    </span>
                                  </div>
                                )}
                              </div>
                            </details>
                          )
                        })}
                      </div>
                    )}

                    {campaignContactsTotal > 50 && (
                      <footer className="campaign-contact-pagination">
                        <span>Página {campaignContactPage + 1} de {Math.ceil(campaignContactsTotal / 50)}</span>
                        <div>
                          <button type="button" disabled={campaignContactPage === 0} onClick={() => setCampaignContactPage((page) => Math.max(page - 1, 0))}>Anterior</button>
                          <button type="button" disabled={(campaignContactPage + 1) * 50 >= campaignContactsTotal} onClick={() => setCampaignContactPage((page) => page + 1)}>Siguiente</button>
                        </div>
                      </footer>
                    )}
                  </section>
                )}

                <div className="campaign-detail-lower">
                  <section className="campaign-days" aria-labelledby="campaign-days-title">
                    <div className="campaign-detail-section-heading">
                      <h5 id="campaign-days-title">Calendario ejecutado</h5>
                      <span>{selectedCampaign.days.length} {selectedCampaign.days.length === 1 ? 'día' : 'días'}</span>
                    </div>
                    {selectedCampaign.days.length ? (
                      <ol>
                        {selectedCampaign.days.map((day) => (
                          <li key={`${day.date}-${day.segment}`}>
                            <span className="campaign-schedule-day"><strong>{day.weekday}</strong><time>{day.date}</time></span>
                            <span className="campaign-schedule-segment"><strong>{day.segment}</strong><small>{day.window}</small></span>
                            <span className="campaign-schedule-total"><strong>{formatCampaignCount(day.contacted)}</strong><small>contactadas</small></span>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>El calendario aparecerá cuando n8n devuelva el seguimiento.</p>
                    )}
                  </section>

                  <div className="campaign-detail-context">
                    <section className="campaign-csv-used" aria-labelledby="campaign-csv-title">
                      <div className="campaign-detail-section-heading"><h5 id="campaign-csv-title">CSV de origen</h5></div>
                      <div className="campaign-csv-file">
                        <FileSpreadsheet aria-hidden="true" />
                        <span>
                          <strong>{selectedCampaign.filename}</strong>
                          <small>
                            {selectedCampaign.csvRows !== null ? `${formatCampaignCount(selectedCampaign.csvRows)} empresas` : 'Empresas sin registrar'}
                            {' · '}
                            {selectedCampaign.csvValid !== null ? `${formatCampaignCount(selectedCampaign.csvValid)} emails válidos` : 'validación pendiente'}
                          </small>
                        </span>
                      </div>
                    </section>

                    <section className="campaign-used-prompt" aria-labelledby="campaign-prompt-title">
                      <div className="campaign-detail-section-heading">
                        <h5 id="campaign-prompt-title">Instrucción utilizada</h5>
                        <button type="button" onClick={() => { setPrompt(selectedCampaign.prompt); setActiveTab('prepare') }}>
                          <RefreshCcw aria-hidden="true" /> Reutilizar
                        </button>
                      </div>
                      <blockquote>{selectedCampaign.prompt}</blockquote>
                    </section>
                  </div>
                </div>
              </article>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function BardoWorkflowProgress({ steps, label }: { steps: BardoWorkflowStep[]; label: string }) {
  const stateLabels: Record<BardoStepState, string> = {
    complete: 'Completada',
    active: 'En curso',
    waiting: 'Pendiente',
    error: 'Con incidencia',
  }

  return (
    <ol className="bardo-workflow" aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.title} data-state={step.state}>
          <span className="sr-only">{stateLabels[step.state]}: </span>
          <span className="bardo-step-mark" aria-hidden="true">
            {step.state === 'complete' ? <Check /> : step.state === 'error' ? '!' : index + 1}
          </span>
          <span className="bardo-step-copy">
            <strong>{step.title}</strong>
            <small>{step.detail}</small>
          </span>
          <time>{step.moment}</time>
        </li>
      ))}
    </ol>
  )
}

function BardoDashboard() {
  const liveTabRef = useRef<HTMLButtonElement>(null)
  const historyTabRef = useRef<HTMLButtonElement>(null)
  const [activeTab, setActiveTab] = useState<'live' | 'history'>('live')
  const [query, setQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState(bardoConversations[0].id)
  const [selectedEmailId, setSelectedEmailId] = useState(bardoConversations[0].emails[0].id)
  const [conversations, setConversations] = useState<BardoConversation[]>(bardoConversations)
  const [conversationDataState, setConversationDataState] = useState<WorkflowDataState>('loading')
  const [conversationRefreshVersion, setConversationRefreshVersion] = useState(0)
  const [emailDetails, setEmailDetails] = useState<Record<string, WorkflowConversationEmail>>({})
  const [emailDetailRequest, setEmailDetailRequest] = useState<{ id: string; state: 'idle' | 'loading' | 'error' }>({ id: '', state: 'idle' })
  const hasLoadedConversationData = useRef(false)
  const loadedEmailDetails = useRef(new Set<string>())

  useEffect(() => {
    let active = true
    let requestInFlight = false

    const refreshConversations = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const result = await workflowApi.conversations(200)
        if (!active) return
        const mapped = result.conversations.map(mapBardoConversation)
        setConversationDataState(result.available ? 'postgres' : 'unavailable')
        if (result.available) {
          hasLoadedConversationData.current = true
          setConversations(mapped)
          setConversationRefreshVersion((version) => version + 1)
        }
      } catch {
        if (active && !hasLoadedConversationData.current) setConversationDataState('error')
      } finally {
        requestInFlight = false
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshConversations()
    }

    void refreshConversations()
    const refreshInterval = window.setInterval(() => void refreshConversations(), 15_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)

    return () => {
      active = false
      window.clearInterval(refreshInterval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [])

  useEffect(() => {
    if (conversationDataState !== 'postgres') return
    const selectedConversation = conversations.find((conversation) => conversation.id === selectedConversationId)
      ?? conversations[0]
      ?? null

    if (!selectedConversation) {
      if (selectedConversationId) setSelectedConversationId('')
      if (selectedEmailId) setSelectedEmailId('')
      return
    }

    if (selectedConversation.id !== selectedConversationId) {
      setSelectedConversationId(selectedConversation.id)
    }
    if (!selectedConversation.emails.some((email) => email.id === selectedEmailId)) {
      setSelectedEmailId(selectedConversation.emails[0]?.id ?? '')
    }
  }, [conversationDataState, conversations, selectedConversationId, selectedEmailId])

  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const filteredConversations = conversations.filter((conversation) => (
    `${conversation.contact} ${conversation.company} ${conversation.email} ${conversation.emails.map((email) => `${email.id} ${email.subject}`).join(' ')}`
      .toLocaleLowerCase('es')
      .includes(normalizedQuery)
  ))
  const selectedConversation = filteredConversations.find((conversation) => conversation.id === selectedConversationId) ?? filteredConversations[0] ?? null
  const selectedEmail = selectedConversation?.emails.find((email) => email.id === selectedEmailId) ?? selectedConversation?.emails[0] ?? null
  const selectedEmailDetail = selectedEmail ? emailDetails[selectedEmail.id] ?? null : null
  const liveConversation = conversations.find((conversation) => conversation.emails.some((email) => email.status === 'active')) ?? null
  const liveEmail = liveConversation?.emails.find((email) => email.status === 'active') ?? null
  const liveSteps: BardoWorkflowStep[] = liveEmail
    ? BARDO_STAGE_COPY.map((step, index) => ({
        ...step,
        state: index < liveEmail.completedSteps ? 'complete' : index === liveEmail.completedSteps ? 'active' : 'waiting',
        moment: index < liveEmail.completedSteps ? 'Completado' : index === liveEmail.completedSteps ? 'Ahora' : '—',
      }))
    : []
  const selectedSteps: BardoWorkflowStep[] = selectedEmail
    ? BARDO_STAGE_COPY.map((step, index) => {
        const isComplete = index < selectedEmail.completedSteps
        const isError = selectedEmail.status === 'failed' && index === selectedEmail.completedSteps
        const isActive = selectedEmail.status === 'active' && index === selectedEmail.completedSteps
        return {
          ...step,
          state: isComplete ? 'complete' : isError ? 'error' : isActive ? 'active' : 'waiting',
          detail: isError ? 'El envío fue rechazado por el servidor de correo' : step.detail,
          moment: isComplete ? `+00:${String(index * 7 + 2).padStart(2, '0')}` : isError ? 'Error' : isActive ? 'Ahora' : '—',
        }
      })
    : []
  useEffect(() => {
    const emailId = selectedEmail?.id
    if (!emailId || conversationDataState !== 'postgres') return

    let active = true
    if (!loadedEmailDetails.current.has(emailId)) {
      setEmailDetailRequest({ id: emailId, state: 'loading' })
    }
    workflowApi.conversationEmail(emailId)
      .then((result) => {
        if (!active) return
        if (result.email) {
          loadedEmailDetails.current.add(emailId)
          setEmailDetails((current) => ({ ...current, [emailId]: result.email as WorkflowConversationEmail }))
        }
        setEmailDetailRequest({ id: emailId, state: result.email ? 'idle' : 'error' })
      })
      .catch(() => active && setEmailDetailRequest({ id: emailId, state: 'error' }))
    return () => { active = false }
  }, [conversationDataState, conversationRefreshVersion, selectedEmail?.id])

  const selectedIncoming = selectedEmail && selectedConversation ? {
    fromEmail: selectedEmailDetail?.incoming.fromEmail || selectedEmail.incoming?.fromEmail || selectedConversation.email,
    toEmail: selectedEmailDetail?.incoming.toEmail || selectedEmail.incoming?.toEmail || 'contacto@ficharia.com',
    body: selectedEmailDetail?.incoming.body || selectedEmail.incoming?.body || selectedEmail.summary,
  } : null
  const selectedReply = selectedEmailDetail?.reply ? {
    ...selectedEmailDetail.reply,
    sentAt: formatDateTime(selectedEmailDetail.reply.sentAt),
  } : selectedEmail?.reply ?? null
  const selectedDetailLoading = selectedEmail
    && emailDetailRequest.id === selectedEmail.id
    && emailDetailRequest.state === 'loading'
  const selectedDetailFailed = selectedEmail
    && emailDetailRequest.id === selectedEmail.id
    && emailDetailRequest.state === 'error'

  const emailStatusLabels: Record<BardoEmailStatus, string> = {
    completed: 'Respondido',
    failed: 'Incidencia',
    active: 'En curso',
  }

  const selectConversation = (conversation: BardoConversation) => {
    setSelectedConversationId(conversation.id)
    setSelectedEmailId(conversation.emails[0]?.id ?? '')
  }

  const changeTab = (tab: 'live' | 'history') => {
    setActiveTab(tab)
    window.requestAnimationFrame(() => (tab === 'live' ? liveTabRef : historyTabRef).current?.focus())
  }

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    changeTab(event.key === 'ArrowLeft' || event.key === 'Home' ? 'live' : 'history')
  }

  return (
    <div className="dashboard-body bardo-control-room">
      <div className="bardo-tabs" role="tablist" aria-label="Vistas del workflow de El Bardo">
        <button
          ref={liveTabRef}
          id="bardo-live-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'live'}
          aria-controls="bardo-live-panel"
          tabIndex={activeTab === 'live' ? 0 : -1}
          onClick={() => setActiveTab('live')}
          onKeyDown={onTabKeyDown}
        >
          <Activity aria-hidden="true" /> En curso
        </button>
        <button
          ref={historyTabRef}
          id="bardo-history-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          aria-controls="bardo-history-panel"
          tabIndex={activeTab === 'history' ? 0 : -1}
          onClick={() => setActiveTab('history')}
          onKeyDown={onTabKeyDown}
        >
          <History aria-hidden="true" /> Historial
        </button>
      </div>

      {activeTab === 'live' ? (
        <section id="bardo-live-panel" className="bardo-layout bardo-layout-live" role="tabpanel" aria-labelledby="bardo-live-tab">
          <section className="bardo-process" aria-labelledby="bardo-process-title">
            <header className="bardo-process-heading">
              <div>
                <h3 id="bardo-process-title">Ejecución en curso</h3>
                <p>{liveConversation ? `${liveConversation.contact} · ${liveConversation.company}` : 'Sin ejecuciones activas'}</p>
              </div>
              <span className="bardo-live-status"><i aria-hidden="true" /> Automático · {conversationDataState === 'postgres' ? 'PostgreSQL' : 'Demo'}</span>
            </header>

            {liveEmail ? (
              <BardoWorkflowProgress steps={liveSteps} label="Progreso de la ejecución actual" />
            ) : (
              <div className="bardo-history-empty" role="status">
                <strong>Sin ejecuciones activas</strong>
                <span>Las nuevas respuestas aparecerán aquí cuando el workflow empiece a procesarlas.</span>
              </div>
            )}
          </section>
        </section>
      ) : (
        <section id="bardo-history-panel" className="bardo-history-panel" role="tabpanel" aria-labelledby="bardo-history-tab">
          <header className="bardo-history-heading">
            <div>
              <h3>Historial de conversaciones</h3>
              <p>Revisa los correos recibidos de cada cliente y cómo procesó El Bardo cada uno.</p>
            </div>
            <span>{workflowDataLabel(conversationDataState)}</span>
          </header>

          <label className="bardo-search">
            <span className="sr-only">Buscar conversaciones</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar contacto, empresa, correo o ID"
            />
          </label>

          <div className="bardo-history-layout">
            <section className="bardo-conversation-index" aria-label="Conversaciones encontradas">
              <p>{filteredConversations.length} {filteredConversations.length === 1 ? 'conversación' : 'conversaciones'}</p>
              {filteredConversations.length ? (
                <ul>
                  {filteredConversations.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        className={selectedConversation?.id === conversation.id ? 'is-selected' : ''}
                        aria-pressed={selectedConversation?.id === conversation.id}
                        onClick={() => selectConversation(conversation)}
                      >
                        <span><strong>{conversation.contact}</strong><small>{conversation.email}</small></span>
                        <span><b>{conversation.emails.length} {conversation.emails.length === 1 ? 'correo recibido' : 'correos recibidos'}</b><time>{conversation.lastActivity}</time></span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bardo-history-empty" role="status">
                  <strong>Sin coincidencias</strong>
                  <span>Prueba con otro contacto, empresa, correo o identificador.</span>
                </div>
              )}
            </section>

            {selectedConversation && selectedEmail && (
              <article className="bardo-conversation-detail">
                <header>
                  <div><h3>{selectedConversation.contact}</h3><p>{selectedConversation.company} · {selectedConversation.email}</p></div>
                  <span>{selectedConversation.emails.length} {selectedConversation.emails.length === 1 ? 'correo recibido' : 'correos recibidos'}</span>
                </header>

                <section className="bardo-thread-mails" aria-labelledby="bardo-thread-title">
                  <h4 id="bardo-thread-title">Correos recibidos</h4>
                  <ul>
                    {selectedConversation.emails.map((email, index) => (
                      <li key={email.id}>
                        <button
                          type="button"
                          className={selectedEmail.id === email.id ? 'is-selected' : ''}
                          aria-pressed={selectedEmail.id === email.id}
                          onClick={() => setSelectedEmailId(email.id)}
                        >
                          <span className="bardo-mail-order">Correo {selectedConversation.emails.length - index}</span>
                          <span><strong>{email.subject}</strong><small>{email.receivedAt}</small></span>
                          <b data-status={email.status}>{emailStatusLabels[email.status]}</b>
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="bardo-email-detail" aria-live="polite">
                  <header>
                    <div><h4>Recorrido del correo</h4><p>{selectedEmail.subject}</p></div>
                    <span data-status={selectedEmail.status}>{emailStatusLabels[selectedEmail.status]}</span>
                  </header>
                  <p className="bardo-email-summary">{selectedEmail.summary}</p>
                  <dl>
                    <div><dt>Recibido</dt><dd>{selectedEmail.receivedAt}</dd></div>
                    <div><dt>Duración</dt><dd>{selectedEmail.duration}</dd></div>
                    <div><dt>ID</dt><dd>{selectedEmail.id}</dd></div>
                  </dl>
                  {selectedIncoming && (
                    <section className="bardo-mail-exchange" aria-labelledby="bardo-mail-exchange-title">
                      <header>
                        <div>
                          <h4 id="bardo-mail-exchange-title">Intercambio</h4>
                          <p>El mensaje que entró y la respuesta que dejó El Bardo.</p>
                        </div>
                      </header>
                      <div className="bardo-mail-pair">
                        <article className="bardo-mail-card is-incoming">
                          <header>
                            <span><MailOpen aria-hidden="true" /> Recibido</span>
                            <time>{selectedEmail.receivedAt}</time>
                          </header>
                          <dl>
                            <div><dt>De</dt><dd>{selectedIncoming.fromEmail}</dd></div>
                            <div><dt>Para</dt><dd>{selectedIncoming.toEmail}</dd></div>
                          </dl>
                          <strong>{selectedEmail.subject}</strong>
                          <p>{selectedIncoming.body}</p>
                        </article>

                        {selectedReply ? (
                          <article className="bardo-mail-card is-outgoing">
                            <header>
                              <span><Send aria-hidden="true" /> Enviado</span>
                              <time>{selectedReply.sentAt}</time>
                            </header>
                            <dl>
                              <div><dt>De</dt><dd>{selectedReply.fromEmail}</dd></div>
                              <div><dt>Para</dt><dd>{selectedReply.toEmail}</dd></div>
                            </dl>
                            <strong>{selectedReply.subject}</strong>
                            <p>{selectedReply.body}</p>
                          </article>
                        ) : (
                          <article className="bardo-mail-card is-pending" role="status">
                            <header><span><Send aria-hidden="true" /> Respuesta</span></header>
                            <strong>{selectedDetailLoading ? 'Cargando intercambio' : selectedDetailFailed ? 'No se pudo cargar' : selectedEmail.status === 'active' ? 'En preparación' : 'Sin envío registrado'}</strong>
                            <p>{selectedDetailLoading
                              ? 'Consultando en PostgreSQL el mensaje saliente enlazado.'
                              : selectedDetailFailed
                                ? 'No se ha podido consultar este mensaje. Selecciona otro correo y vuelve a intentarlo.'
                                : selectedEmail.status === 'active'
                              ? 'La respuesta aparecerá aquí cuando El Bardo termine de redactarla y la registre en PostgreSQL.'
                              : 'No consta una respuesta saliente enlazada a este correo.'}</p>
                          </article>
                        )}
                      </div>
                    </section>
                  )}
                  <BardoWorkflowProgress steps={selectedSteps} label={`Recorrido de ${selectedEmail.subject}`} />
                </section>
              </article>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function BucleDashboard() {
  const queueTabRef = useRef<HTMLButtonElement>(null)
  const historyTabRef = useRef<HTMLButtonElement>(null)
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')
  const [query, setQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState('')
  const [conversations, setConversations] = useState<BucleConversation[]>([])
  const [followupDataState, setFollowupDataState] = useState<WorkflowDataState>('loading')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [refreshVersion, setRefreshVersion] = useState(0)

  useEffect(() => {
    let active = true
    let requestInFlight = false
    const controller = new AbortController()
    const refresh = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const result = await workflowApi.followups(200, AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]))
        if (!active) return
        const mapped = result.conversations.map(mapBucleConversation)
        setFollowupDataState(result.available ? 'postgres' : 'unavailable')
        setConversations(result.available ? mapped : [])
        setLastUpdatedAt(result.available ? new Date().toISOString() : null)
      } catch {
        if (active) setFollowupDataState('error')
      } finally {
        requestInFlight = false
      }
    }
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    void refresh()
    const interval = window.setInterval(refreshWhenVisible, 15_000)
    document.addEventListener('visibilitychange', refreshWhenVisible)
    window.addEventListener('focus', refreshWhenVisible)
    return () => {
      active = false
      controller.abort()
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refreshWhenVisible)
      window.removeEventListener('focus', refreshWhenVisible)
    }
  }, [refreshVersion])

  const waitingConversations = conversations.filter((conversation) => ['waiting', 'generating', 'sending'].includes(conversation.state))
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const filteredConversations = conversations.filter((conversation) => (
    `${conversation.contact} ${conversation.company} ${conversation.email} ${bucleStateLabels[conversation.state]}`
      .toLocaleLowerCase('es')
      .includes(normalizedQuery)
  ))
  const selectedConversation = filteredConversations.find((conversation) => conversation.id === selectedConversationId)
    ?? filteredConversations[0]
    ?? null

  const followUpLabel = (count: number) => count === 1 ? '1 recontacto enviado' : `${count} recontactos enviados`

  const moveTabFocus = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const nextTab = event.key === 'ArrowLeft' || event.key === 'Home' ? 'queue' : 'history'
    setActiveTab(nextTab)
    window.requestAnimationFrame(() => (nextTab === 'queue' ? queueTabRef : historyTabRef).current?.focus())
  }

  return (
    <div className="dashboard-body bucle-control-room">
      <div className="bucle-refresh" aria-live="polite">
        <span>{followupDataState === 'error'
          ? lastUpdatedAt ? 'No se pudo actualizar. Se conserva la última consulta; los datos pueden haber cambiado.' : 'No se pudo consultar el seguimiento. Pulsa Actualizar para reintentar.'
          : followupDataState === 'unavailable' ? 'El seguimiento todavía no está disponible en la base de datos.'
            : lastUpdatedAt ? `Última consulta: ${formatBucleDate(lastUpdatedAt)} · Actualización cada 15 s`
              : 'Consultando seguimiento…'}</span>
        <button type="button" onClick={() => setRefreshVersion((version) => version + 1)}><RefreshCcw aria-hidden="true" /> Actualizar</button>
      </div>
      <div className="bucle-tabs" role="tablist" aria-label="Secciones de seguimiento semanal">
        <button
          ref={queueTabRef}
          id="bucle-queue-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'queue'}
          aria-controls="bucle-queue-panel"
          tabIndex={activeTab === 'queue' ? 0 : -1}
          onClick={() => setActiveTab('queue')}
          onKeyDown={moveTabFocus}
        >
          <Clock3 aria-hidden="true" /> En espera
        </button>
        <button
          ref={historyTabRef}
          id="bucle-history-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'history'}
          aria-controls="bucle-history-panel"
          tabIndex={activeTab === 'history' ? 0 : -1}
          onClick={() => setActiveTab('history')}
          onKeyDown={moveTabFocus}
        >
          <History aria-hidden="true" /> Historial
        </button>
      </div>

      {activeTab === 'queue' && (
        <section id="bucle-queue-panel" className="bucle-queue-panel" role="tabpanel" aria-labelledby="bucle-queue-tab">
          <header className="bucle-panel-heading">
            <div>
              <h3>Seguimiento semanal</h3>
              <p>Conversaciones a las que El Bardo escribió y todavía no han respondido.</p>
            </div>
            <span className="bucle-demo-label">{workflowDataLabel(followupDataState)}</span>
          </header>

          <div className="bucle-fixed-rule">
            <Clock3 aria-hidden="true" />
            <div><strong>Lunes · 10:00</strong><span>Hora de Madrid · mínimo 7 días sin respuesta</span></div>
            <p>Revisión semanal de hasta 10 seguimientos. Las fechas son previsiones: dependen de que el flujo esté activo y haya capacidad. Las respuestas y bajas detienen el seguimiento.</p>
          </div>

          <div className="bucle-queue-heading">
            <h4>Próximas revisiones</h4>
            <span>{waitingConversations.length} en seguimiento</span>
          </div>
          <ol className="bucle-next-list">
            {waitingConversations.map((conversation) => (
              <li key={conversation.id}>
                <span className="bucle-countdown"><small>{conversation.state === 'waiting' ? 'Revisión en' : 'Estado'}</small><strong>{conversation.state === 'waiting' ? conversation.nextIn : bucleStateLabels[conversation.state]}</strong></span>
                <span className="bucle-next-contact">
                  <strong>{conversation.contact}</strong>
                  <small>{conversation.company} · {conversation.email}</small>
                </span>
                <span className="bucle-next-meta">
                  <strong>{conversation.nextFollowUpAt ? formatBucleDate(conversation.nextFollowUpAt) : bucleStateLabels[conversation.state]}</strong>
                  <small>{conversation.followUpCount ? followUpLabel(conversation.followUpCount) : 'Será el primer recontacto'}</small>
                </span>
              </li>
            ))}
          </ol>
          {!waitingConversations.length && <p className="bucle-empty" role="status">{followupDataState === 'postgres' ? 'No hay conversaciones esperando seguimiento. Las próximas aparecerán aquí cuando cumplan las condiciones.' : followupDataState === 'loading' ? 'Cargando conversaciones…' : 'La cola no está disponible. Consulta el estado de conexión de arriba.'}</p>}
          {conversations.length >= 200 && <p className="bucle-empty">Se muestran hasta 200 conversaciones, dando prioridad a las próximas revisiones.</p>}
        </section>
      )}

      {activeTab === 'history' && (
        <section id="bucle-history-panel" className="bucle-history-panel" role="tabpanel" aria-labelledby="bucle-history-tab">
          <header className="bucle-panel-heading">
            <div>
              <h3>Historial de seguimiento</h3>
              <p>Busca una conversación y revisa sus recontactos semanales.</p>
            </div>
            <span className="bucle-demo-label">{workflowDataLabel(followupDataState)}</span>
          </header>

          <label className="bucle-history-search">
            <Search aria-hidden="true" />
            <span className="sr-only">Buscar conversaciones</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar persona, empresa o correo"
            />
          </label>

          <div className="bucle-history-layout">
            <section className="bucle-history-index" aria-label="Conversaciones encontradas">
              <div className="bucle-history-count"><strong>{filteredConversations.length}</strong><span>conversaciones</span></div>
              {filteredConversations.length ? (
                <ul>
                  {filteredConversations.map((conversation) => (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        className={selectedConversation?.id === conversation.id ? 'is-selected' : ''}
                        aria-pressed={selectedConversation?.id === conversation.id}
                        onClick={() => setSelectedConversationId(conversation.id)}
                      >
                        <span className="bucle-history-person"><strong>{conversation.contact}</strong><small>{conversation.company}</small></span>
                        <span className="bucle-history-email">{conversation.email}</span>
                        <span className="bucle-history-state" data-state={conversation.state}>
                          {conversation.state === 'waiting' ? `Revisión en ${conversation.nextIn}` : bucleStateLabels[conversation.state]}
                        </span>
                        <span className="bucle-history-laps">
                          <strong>{conversation.followUpCount}</strong>
                          <small>{conversation.followUpCount === 1 ? 'recontacto' : 'recontactos'}</small>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bucle-history-empty"><Search aria-hidden="true" /><strong>{query ? 'Sin coincidencias' : followupDataState === 'postgres' ? 'Sin seguimientos todavía' : 'Historial no disponible'}</strong><span>{query ? 'Prueba con otro nombre, empresa o correo.' : followupDataState === 'postgres' ? 'Las conversaciones aparecerán cuando entren en seguimiento.' : 'Consulta el estado de conexión de arriba.'}</span></div>
              )}
            </section>

            {selectedConversation && (
              <article className="bucle-history-detail" aria-live="polite">
                <header>
                  <div><h4>{selectedConversation.contact}</h4><p>{selectedConversation.company} · {selectedConversation.email}</p></div>
                  <span data-state={selectedConversation.state}>{bucleStateLabels[selectedConversation.state]}</span>
                </header>

                <dl className="bucle-history-facts">
                  <div><dt>Mensaje de El Bardo</dt><dd>{selectedConversation.lastBardoMessageAt}</dd></div>
                  <div><dt>Revisión prevista · Madrid</dt><dd>{selectedConversation.nextFollowUpAt ? `${formatBucleDate(selectedConversation.nextFollowUpAt)} · faltan ${selectedConversation.nextIn}` : bucleStateLabels[selectedConversation.state]}</dd></div>
                  <div><dt>Recontactos automáticos</dt><dd>{followUpLabel(selectedConversation.followUpCount)}</dd></div>
                </dl>
                {selectedConversation.eligibleAt && <p className="bucle-eligible">Mínimo de siete días cumplido el {formatBucleDate(selectedConversation.eligibleAt)}. Se recogerá en una revisión posterior si sigue sin respuesta.</p>}

                <section className="bucle-event-history" aria-labelledby="bucle-event-history-title">
                  <div className="bucle-event-heading"><h5 id="bucle-event-history-title">Historial de seguimiento</h5><span>Fechas en hora de Madrid</span></div>
                  <ol>
                    {selectedConversation.events.map((event) => (
                      <li key={event.id} data-type={event.type}>
                        <span className="bucle-event-mark">{event.type === 'reply' ? <Check aria-hidden="true" /> : event.type === 'issue' ? <AlertTriangle aria-hidden="true" /> : event.type === 'cancelled' ? <X aria-hidden="true" /> : <Send aria-hidden="true" />}</span>
                        <span><strong>{event.title}</strong><small>{event.note}</small></span>
                        <time dateTime={event.at || undefined}>{formatBucleDate(event.at)}</time>
                      </li>
                    ))}
                  </ol>
                </section>
              </article>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

function MarketingDashboard() {
  const createTabRef = useRef<HTMLButtonElement>(null)
  const libraryTabRef = useRef<HTMLButtonElement>(null)
  const generationTimerRef = useRef<number | null>(null)
  const referenceObjectUrlRef = useRef<string | null>(null)
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create')
  const [prompt, setPrompt] = useState('')
  const [assets, setAssets] = useState<MarketingAsset[]>(demoMarketingAssets)
  const [previewAssetId, setPreviewAssetId] = useState(demoMarketingAssets[0].id)
  const [selectedAssetId, setSelectedAssetId] = useState(demoMarketingAssets[0].id)
  const [creativeDataState, setCreativeDataState] = useState<WorkflowDataState>('loading')
  const [query, setQuery] = useState('')
  const [referencePreview, setReferencePreview] = useState<string | null>(null)
  const [referenceName, setReferenceName] = useState('')
  const [reviewerEmail, setReviewerEmail] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (generationTimerRef.current) window.clearTimeout(generationTimerRef.current)
    if (referenceObjectUrlRef.current) URL.revokeObjectURL(referenceObjectUrlRef.current)
  }, [])

  useEffect(() => {
    let active = true
    workflowApi.creatives(200)
      .then((result) => {
        if (!active) return
        const mapped = result.assets.map(mapMarketingAsset).filter((asset): asset is MarketingAsset => Boolean(asset))
        setCreativeDataState(result.available ? 'postgres' : 'unavailable')
        if (result.available) setAssets(mapped)
        if (mapped[0]) {
          setPreviewAssetId(mapped[0].id)
          setSelectedAssetId(mapped[0].id)
        }
      })
      .catch(() => active && setCreativeDataState('error'))
    return () => { active = false }
  }, [])

  const statusLabels: Record<MarketingAssetStatus, string> = {
    draft: 'Borrador',
    'in-review': 'En revisión',
    approved: 'Aprobada para El Visionario',
  }

  const previewAsset = assets.find((asset) => asset.id === previewAssetId) ?? assets[0] ?? demoMarketingAssets[0]
  const normalizedQuery = query.trim().toLocaleLowerCase('es')
  const filteredAssets = assets.filter((asset) => (
    `${asset.title} ${asset.prompt} ${asset.referenceName ?? ''} ${statusLabels[asset.status]}`
      .toLocaleLowerCase('es')
      .includes(normalizedQuery)
  ))
  const selectedAsset = filteredAssets.find((asset) => asset.id === selectedAssetId)
    ?? filteredAssets[0]
    ?? null

  const changeTab = (tab: 'create' | 'library') => {
    setActiveTab(tab)
    setMessage('')
    setError('')
    window.requestAnimationFrame(() => (tab === 'create' ? createTabRef : libraryTabRef).current?.focus())
  }

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    changeTab(event.key === 'ArrowLeft' || event.key === 'Home' ? 'create' : 'library')
  }

  const clearReference = () => {
    if (referenceObjectUrlRef.current) URL.revokeObjectURL(referenceObjectUrlRef.current)
    referenceObjectUrlRef.current = null
    setReferencePreview(null)
    setReferenceName('')
  }

  const handleReference = (file: File | null) => {
    setError('')
    setMessage('')
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setError('La referencia debe ser PNG, JPG o WebP.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('La referencia no puede superar los 10 MB.')
      return
    }
    clearReference()
    const objectUrl = URL.createObjectURL(file)
    referenceObjectUrlRef.current = objectUrl
    setReferencePreview(objectUrl)
    setReferenceName(file.name)
  }

  const createPreview = () => {
    const cleanPrompt = prompt.trim()
    if (!cleanPrompt) {
      setError('Escribe una idea antes de crear la vista previa.')
      return
    }

    setError('')
    setMessage('')
    setIsGenerating(true)
    generationTimerRef.current = window.setTimeout(() => {
      const demoImages = [marketingAgriculture, marketingWinery, marketingCreativeStudio]
      const createdAsset: MarketingAsset = {
        id: `VISUAL-DEMO-${Date.now()}`,
        title: cleanPrompt.split(/\s+/).slice(0, 5).join(' '),
        prompt: cleanPrompt,
        image: demoImages[assets.length % demoImages.length],
        createdAt: 'Ahora · demostración',
        status: 'draft',
        referenceName: referenceName || undefined,
      }
      setAssets((current) => [createdAsset, ...current])
      setPreviewAssetId(createdAsset.id)
      setSelectedAssetId(createdAsset.id)
      setIsGenerating(false)
      setMessage('Vista previa de demostración creada. La generación real se conectará al workflow de n8n.')
      generationTimerRef.current = null
    }, 900)
  }

  const prepareReview = () => {
    const email = reviewerEmail.trim()
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Indica un correo válido para preparar la revisión.')
      return
    }
    setAssets((current) => current.map((asset) => (
      asset.id === previewAsset.id ? { ...asset, status: 'in-review' } : asset
    )))
    setError('')
    setMessage(`Revisión preparada para ${email}. El envío real se activará al conectar n8n.`)
  }

  const reuseAsset = (asset: MarketingAsset) => {
    if (referenceObjectUrlRef.current) URL.revokeObjectURL(referenceObjectUrlRef.current)
    referenceObjectUrlRef.current = null
    setPrompt(asset.prompt)
    setReferencePreview(asset.image)
    setReferenceName(`${asset.title}.webp`)
    setPreviewAssetId(asset.id)
    setMessage('Visual cargado como referencia. Ajusta el prompt para crear una nueva versión.')
    setError('')
    setActiveTab('create')
    window.requestAnimationFrame(() => createTabRef.current?.focus())
  }

  const downloadName = (asset: MarketingAsset) => `${asset.title
    .toLocaleLowerCase('es')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'visual-kaam'}.webp`

  return (
    <div className="dashboard-body marketing-control-room">
      <div className="marketing-tabs" role="tablist" aria-label="Secciones del Taller Creativo">
        <button
          ref={createTabRef}
          id="marketing-create-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'create'}
          aria-controls="marketing-create-panel"
          tabIndex={activeTab === 'create' ? 0 : -1}
          onClick={() => setActiveTab('create')}
          onKeyDown={onTabKeyDown}
        >
          <Palette aria-hidden="true" /> Crear
        </button>
        <button
          ref={libraryTabRef}
          id="marketing-library-tab"
          type="button"
          role="tab"
          aria-selected={activeTab === 'library'}
          aria-controls="marketing-library-panel"
          tabIndex={activeTab === 'library' ? 0 : -1}
          onClick={() => setActiveTab('library')}
          onKeyDown={onTabKeyDown}
        >
          <Library aria-hidden="true" /> Biblioteca
        </button>
      </div>

      {activeTab === 'create' ? (
        <section id="marketing-create-panel" className="marketing-create-panel" role="tabpanel" aria-labelledby="marketing-create-tab">
          <section className="marketing-composer" aria-labelledby="marketing-composer-title">
            <header>
              <div>
                <h3 id="marketing-composer-title">Crear una imagen</h3>
                <p>Describe la pieza que acompañará a la campaña.</p>
              </div>
              <span>Prototipo</span>
            </header>

            <label className="marketing-prompt-field">
              <span>Prompt</span>
              <textarea
                value={prompt}
                maxLength={1200}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Ej. Una bodega al amanecer donde las barricas se conectan con un hilo naranja, estilo editorial y sin texto..."
              />
              <small>{prompt.length}/1200</small>
            </label>

            <div className="marketing-reference-field">
              <div className="marketing-field-heading">
                <span>Imagen de referencia <small>Opcional</small></span>
                <small>PNG, JPG o WebP · máximo 10 MB</small>
              </div>
              {referencePreview ? (
                <div className="marketing-reference-preview">
                  <img src={referencePreview} alt="Referencia seleccionada" />
                  <div><strong>{referenceName}</strong><span>Se usará junto al prompt</span></div>
                  <button type="button" onClick={clearReference}>Quitar</button>
                </div>
              ) : (
                <label className="marketing-reference-upload">
                  <Upload aria-hidden="true" />
                  <span><strong>Adjuntar referencia</strong><small>Selecciona una imagen de tu equipo</small></span>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => {
                      handleReference(event.currentTarget.files?.[0] ?? null)
                      event.currentTarget.value = ''
                    }}
                  />
                </label>
              )}
            </div>

            <button className="marketing-generate" type="button" disabled={isGenerating} onClick={createPreview}>
              {isGenerating ? <LoaderCircle className="is-spinning" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              {isGenerating ? 'Preparando vista previa…' : 'Crear vista previa · Demo'}
            </button>
          </section>

          <section className="marketing-visualizer" aria-labelledby="marketing-visualizer-title">
            <header>
              <div><ImageIcon aria-hidden="true" /><h3 id="marketing-visualizer-title">Visualizador</h3></div>
              <span data-status={previewAsset.status}>{statusLabels[previewAsset.status]}</span>
            </header>
            <figure>
              <img src={previewAsset.image} alt={`Vista previa: ${previewAsset.title}`} />
              <figcaption>{previewAsset.title}</figcaption>
            </figure>

            <div className="marketing-review">
              <label>
                <span>Correo de revisión</span>
                <input
                  type="email"
                  value={reviewerEmail}
                  onChange={(event) => setReviewerEmail(event.target.value)}
                  placeholder="persona@empresa.com"
                />
              </label>
              <button type="button" onClick={prepareReview}><Send aria-hidden="true" /> Preparar revisión</button>
            </div>
            <p className="marketing-handoff"><Workflow aria-hidden="true" /> Al aprobarse, n8n podrá marcarla como imagen activa para los correos de El Visionario. Conexión pendiente.</p>
          </section>

          {(message || error) && <p className="marketing-feedback" data-kind={error ? 'error' : 'success'} role="status">{error || message}</p>}
        </section>
      ) : (
        <section id="marketing-library-panel" className="marketing-library-panel" role="tabpanel" aria-labelledby="marketing-library-tab">
          <header className="marketing-library-heading">
            <div><h3>Biblioteca visual</h3><p>Prompts, versiones y piezas preparadas para campañas.</p></div>
            <span>{workflowDataLabel(creativeDataState)}</span>
          </header>

          <label className="marketing-search">
            <span className="sr-only">Buscar en la biblioteca visual</span>
            <Search aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por pieza, prompt, referencia o estado"
            />
          </label>

          <div className="marketing-library-layout">
            <section className="marketing-asset-index" aria-label="Visuales encontrados">
              <p>{filteredAssets.length} {filteredAssets.length === 1 ? 'visual' : 'visuales'}</p>
              {filteredAssets.length ? (
                <ul>
                  {filteredAssets.map((asset) => (
                    <li key={asset.id}>
                      <button
                        type="button"
                        className={selectedAsset?.id === asset.id ? 'is-selected' : ''}
                        aria-pressed={selectedAsset?.id === asset.id}
                        onClick={() => setSelectedAssetId(asset.id)}
                      >
                        <img src={asset.image} alt="" />
                        <span><strong>{asset.title}</strong><small>{asset.createdAt}</small></span>
                        <b data-status={asset.status}>{statusLabels[asset.status]}</b>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="marketing-library-empty" role="status">
                  <ImageIcon aria-hidden="true" />
                  <strong>Sin coincidencias</strong>
                  <span>Prueba con otra pieza, prompt, referencia o estado.</span>
                </div>
              )}
            </section>

            {selectedAsset && (
              <article className="marketing-asset-detail" aria-live="polite">
                <figure><img src={selectedAsset.image} alt={selectedAsset.title} /></figure>
                <header>
                  <div><h4>{selectedAsset.title}</h4><p>{selectedAsset.createdAt}</p></div>
                  <span data-status={selectedAsset.status}>{statusLabels[selectedAsset.status]}</span>
                </header>
                <section>
                  <h5>Prompt usado</h5>
                  <p>{selectedAsset.prompt}</p>
                </section>
                <dl>
                  <div><dt>Referencia</dt><dd>{selectedAsset.referenceName ?? 'Sin imagen de referencia'}</dd></div>
                  <div><dt>ID</dt><dd>{selectedAsset.id}</dd></div>
                </dl>
                <div className="marketing-asset-actions">
                  <button type="button" onClick={() => reuseAsset(selectedAsset)}><RefreshCcw aria-hidden="true" /> Reutilizar como referencia</button>
                  <a href={selectedAsset.image} download={downloadName(selectedAsset)}><Download aria-hidden="true" /> Descargar</a>
                </div>
              </article>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

export default function DashboardModal({ agent, onClose, csrfToken }: DashboardModalProps) {
  if (!agent) return null
  return (
    <ModalShell agent={agent} onClose={onClose} csrfToken={csrfToken}>
      {agent === 'prospecto' && <ProspectoDashboard csrfToken={csrfToken} />}
      {agent === 'bardo' && <BardoDashboard />}
      {agent === 'marketing' && <MarketingDashboard />}
      {agent === 'bucle' && <BucleDashboard />}
    </ModalShell>
  )
}
