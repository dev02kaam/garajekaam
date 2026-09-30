import { campaignImportPolicy as policy } from './campaign-import-policy.mjs'

export class CsvError extends Error {
  constructor(message) { super(message); this.code = 'INVALID_CSV'; this.status = 400 }
}
const normalizeKey = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
const aliases = {
  email: ['email', 'correo', 'correo_electronico', 'e_mail', 'mail'],
  name: ['nombre', 'name', 'contacto', 'contact_name', 'nombre_contacto'],
  company: ['empresa', 'company', 'compania', 'organizacion', 'organization', 'razon_social'],
  optout: ['no_contactar', 'baja', 'opt_out', 'unsubscribe', 'suprimido', 'suppressed'],
}

// Incremental RFC-style CSV reader: quoted separators/newlines and escaped quotes
// survive arbitrary byte/chunk boundaries. No full-file string or row array.
export class CampaignCsvReader {
  constructor(limits = policy) {
    this.limits = limits; this.decoder = new TextDecoder('utf-8', { fatal: true })
    this.bytes = 0; this.headerBuffer = ''; this.delimiter = null; this.headers = null
    this.columns = []; this.keys = {}; this.field = ''; this.row = []; this.recordSize = 0
    this.quoted = false; this.afterQuote = false; this.skipLf = false; this.seen = new Set()
    this.rows = 0; this.valid = 0; this.skipped = { invalid_email: 0, duplicate_email: 0, opted_out: 0 }
  }
  push(bytes) {
    this.bytes += bytes.byteLength
    if (this.bytes > this.limits.maxBytes) throw new CsvError('El CSV supera el máximo de 100 MB.')
    let text
    try { text = this.decoder.decode(bytes, { stream: true }) }
    catch { throw new CsvError('Guarda el archivo como CSV UTF-8 y vuelve a seleccionarlo.') }
    return this.read(text)
  }
  read(text, final = false) {
    if (text.includes('\0')) throw new CsvError('El archivo contiene bytes NUL. Exporta como CSV UTF-8.')
    if (!this.delimiter) {
      this.headerBuffer += text
      const end = this.headerBuffer.search(/[\r\n]/)
      if (end < 0 && !final) {
        if (this.headerBuffer.length > this.limits.maxRecordCharacters) throw new CsvError('La cabecera del CSV es demasiado larga.')
        return []
      }
      const header = (end < 0 ? this.headerBuffer : this.headerBuffer.slice(0, end)).replace(/^\uFEFF/, '')
      const counts = new Map([[',', 0], [';', 0], ['\t', 0]])
      let quoted = false
      for (let i = 0; i < header.length; i++) {
        if (header[i] === '"') {
          if (quoted && header[i + 1] === '"') i++
          else quoted = !quoted
        } else if (!quoted && counts.has(header[i])) counts.set(header[i], counts.get(header[i]) + 1)
      }
      if (quoted) throw new CsvError('La cabecera contiene comillas sin cerrar o saltos de línea.')
      this.delimiter = [...counts].sort((a, b) => b[1] - a[1])[0][0]
      text = this.headerBuffer.replace(/^\uFEFF/, ''); this.headerBuffer = ''
    }
    const contacts = []
    const field = () => { this.row.push(this.field.trim()); this.field = ''; this.afterQuote = false
      if (this.row.length > this.limits.maxColumns) throw new CsvError('El CSV supera el máximo de 100 columnas.') }
    const record = () => { field(); this.consume(this.row, contacts); this.row = []; this.recordSize = 0 }
    for (const char of text) {
      if (this.skipLf) { this.skipLf = false; if (char === '\n') continue }
      if (++this.recordSize > this.limits.maxRecordCharacters) throw new CsvError(`La fila ${this.rows + 2} es demasiado larga.`)
      if (this.quoted) {
        if (char === '"') { this.quoted = false; this.afterQuote = true }
        else this.field += char
      } else if (this.afterQuote && char === '"') { this.quoted = true; this.afterQuote = false; this.field += '"' }
      else if (char === this.delimiter) field()
      else if (char === '\n' || char === '\r') { record(); this.skipLf = char === '\r' }
      else if (this.afterQuote) {
        if (char !== ' ' && char !== '\t') throw new CsvError(`Comillas mal cerradas en la fila ${this.rows + 2}.`)
      } else if (char === '"') {
        if (this.field.trim()) throw new CsvError(`Comillas inesperadas en la fila ${this.rows + 2}.`)
        this.field = ''; this.quoted = true
      } else this.field += char
    }
    if (final) {
      if (this.quoted) throw new CsvError('El CSV contiene comillas sin cerrar.')
      if (this.field || this.row.length || this.afterQuote) record()
      if (!this.headers || !this.rows) throw new CsvError('Incluye una cabecera y al menos una fila de contactos.')
      if (!this.valid) throw new CsvError('No quedan correos válidos después de descartar duplicados, bajas y errores.')
    }
    return contacts
  }
  consume(row, contacts) {
    if (row.every(value => !value)) return
    if (!this.headers) {
      this.columns = row; this.headers = row.map(normalizeKey)
      if (this.headers.some(h => !h) || new Set(this.headers).size !== this.headers.length) throw new CsvError('Revisa las cabeceras: no pueden estar vacías ni repetidas.')
      for (const [key, names] of Object.entries(aliases)) this.keys[key] = names.find(name => this.headers.includes(name))
      if (!this.keys.email) throw new CsvError('Falta una columna Email o Correo.')
      return
    }
    if (++this.rows > this.limits.maxRows) throw new CsvError('El CSV supera el máximo de 1.000.000 de filas.')
    if (row.length > this.headers.length) throw new CsvError(`La fila ${this.rows + 1} tiene más columnas que la cabecera. Revisa las comillas y el separador.`)
    const data = Object.fromEntries(this.headers.map((header, i) => [header, (row[i] || '').slice(0, 1000)]))
    const email = data[this.keys.email].trim().toLowerCase()
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 320) { this.skipped.invalid_email++; return }
    if (this.seen.has(email)) { this.skipped.duplicate_email++; return }
    this.seen.add(email)
    if (this.keys.optout && /^(?:1|true|si|sí|yes|y|x|baja|no_contactar)$/i.test(data[this.keys.optout])) { this.skipped.opted_out++; return }
    this.valid++
    contacts.push({ ...data, email, name: data[this.keys.name] || '', company: data[this.keys.company] || '', _csv_row: this.rows + 1 })
  }
  finish() {
    let remaining
    try { remaining = this.decoder.decode() }
    catch { throw new CsvError('Guarda el archivo como CSV UTF-8 y vuelve a seleccionarlo.') }
    return this.read(remaining, true)
  }
  summary() { return { rows: this.rows, valid: this.valid, issues: this.rows - this.valid, columns: this.columns, skipped: { ...this.skipped } } }
}
