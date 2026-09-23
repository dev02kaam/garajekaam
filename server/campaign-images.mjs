import { createHash } from 'node:crypto'
import sharp from 'sharp'

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const sharpOptions = { failOn: 'warning', limitInputPixels: 25_000_000 }
const formats = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }

export class CampaignImageError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function validateCampaignImage(file) {
  if (!file?.buffer?.length) throw new CampaignImageError(400, 'IMAGE_REQUIRED', 'Selecciona una imagen.')
  if (file.buffer.length > MAX_IMAGE_BYTES) throw new CampaignImageError(413, 'IMAGE_TOO_LARGE', 'La imagen supera el máximo de 10 MB.')
  const bytes = file.buffer
  const signature = bytes.subarray(0, 12)
  const format = signature.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) ? 'png'
    : signature.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')) ? 'jpeg'
      : signature.subarray(0, 4).toString() === 'RIFF' && signature.subarray(8, 12).toString() === 'WEBP' ? 'webp' : null
  if (!format || bytes.length < 100) throw new CampaignImageError(400, 'INVALID_IMAGE', 'El archivo debe ser una imagen PNG, JPG o WebP válida.')
  if (file.mimetype && ![formats[format], 'application/octet-stream'].includes(file.mimetype)) {
    throw new CampaignImageError(400, 'IMAGE_TYPE_MISMATCH', 'El tipo del archivo no coincide con el contenido de la imagen.')
  }
  try {
    const decoder = sharp(bytes, sharpOptions)
    const metadata = await decoder.metadata()
    if (metadata.format !== format || !metadata.width || !metadata.height || metadata.width > 10000 || metadata.height > 10000 || (metadata.pages || 1) > 1) {
      throw new Error('unsupported dimensions or animation')
    }
    // Decode all pixels; a valid signature/metadata alone can hide a truncated file.
    await decoder.stats()
  } catch {
    throw new CampaignImageError(400, 'INVALID_IMAGE', 'No se puede abrir la imagen. Usa PNG, JPG o WebP sin animación, de hasta 25 megapíxeles y 10.000 px por lado.')
  }
  let stem = String(file.originalname || 'imagen').split(/[\\/]/).pop()
    .normalize('NFC').replace(/\.[^.]*$/, '').replace(/[<>:"|?*\x00-\x1f\x7f]/g, '').trim() || 'imagen'
  const extension = format === 'jpeg' ? 'jpg' : format
  while (Buffer.byteLength(stem + '.' + extension) > 180) stem = Array.from(stem).slice(0, -1).join('')
  return { buffer: bytes, fileName: stem + '.' + extension, mimeType: formats[format], sha256: createHash('sha256').update(bytes).digest('hex') }
}

const fields = `asset_key, file_name, mime_type, sha256, sort_order, active,
  octet_length(image_data) AS size_bytes, created_at, updated_at, xmin::text AS revision`
const mapImage = (row) => ({
  id: row.asset_key, fileName: row.file_name, mimeType: row.mime_type,
  sha256: row.sha256, sortOrder: row.sort_order, active: row.active,
  sizeBytes: row.size_bytes, createdAt: row.created_at, updatedAt: row.updated_at, revision: row.revision,
})

// Pool/schema injection keeps the same operations reusable by the future creative studio.
export function createCampaignImageStore(pool, schema = 'public', prefix = 'ficharia-campana-') {
  if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) throw new Error('Invalid campaign image schema')
  if (!/^[a-z][a-z0-9-]*-$/.test(prefix)) throw new Error('Invalid campaign image prefix')
  const validId = (id) => {
    if (typeof id !== 'string' || !new RegExp('^' + prefix + '[0-9]{2}$').test(id)) {
      throw new CampaignImageError(404, 'IMAGE_NOT_FOUND', 'No se encontró la imagen de este producto.')
    }
  }
  const table = `"${schema}".campaign_email_assets`
  const thumbnails = new Map()

  async function transaction(work) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      // Serializes management writes (including last-active checks), while email reads continue.
      await client.query(`LOCK TABLE ${table} IN SHARE ROW EXCLUSIVE MODE`)
      const result = await work(client)
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      if (error.code === '42P01') throw new CampaignImageError(409, 'IMAGE_LIBRARY_UNAVAILABLE', 'La biblioteca de imágenes todavía no está configurada.')
      if (error.code === '23505') throw new CampaignImageError(409, 'IMAGE_CONFLICT', 'La imagen ya existe o la biblioteca ha cambiado. Actualiza e inténtalo de nuevo.')
      throw error
    } finally { client.release() }
  }

  async function current(client, id, revision) {
    validId(id)
    const row = (await client.query(`SELECT ${fields} FROM ${table} WHERE asset_key = $1`, [id])).rows[0]
    if (!row) throw new CampaignImageError(404, 'IMAGE_NOT_FOUND', 'La imagen ya no está en la biblioteca.')
    if (row.revision !== revision) throw new CampaignImageError(409, 'IMAGE_CHANGED', 'Esta imagen ha cambiado en otra sesión. Actualiza la biblioteca y vuelve a intentarlo.')
    return row
  }

  return {
    async list() {
      const exists = (await pool.query('SELECT to_regclass($1) IS NOT NULL AS present', [table])).rows[0].present
      if (!exists) return { available: false, images: [] }
      const rows = (await pool.query(`SELECT ${fields} FROM ${table} ORDER BY sort_order, asset_key`)).rows
      return { available: true, images: rows.map(mapImage) }
    },
    async upload(file) {
      const image = await validateCampaignImage(file)
      return transaction(async (client) => {
        const duplicate = (await client.query(`SELECT ${fields} FROM ${table} WHERE sha256 = $1`, [image.sha256])).rows[0]
        if (duplicate) return { image: mapImage(duplicate), duplicate: true }
        const slot = (await client.query(`SELECT
          (SELECT n FROM generate_series(1,100) n WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE sort_order = n) ORDER BY n LIMIT 1) AS position,
          (SELECT '${prefix}' || lpad(n::text,2,'0') FROM generate_series(0,99) n
            WHERE NOT EXISTS (SELECT 1 FROM ${table} WHERE asset_key = '${prefix}' || lpad(n::text,2,'0'))
            ORDER BY CASE WHEN n = 0 THEN 100 ELSE n END LIMIT 1) AS key`)).rows[0]
        if (!slot.position || !slot.key) throw new CampaignImageError(409, 'IMAGE_LIBRARY_FULL', 'La biblioteca ha alcanzado su capacidad de 100 imágenes. Puedes sustituir una existente.')
        const row = (await client.query(`INSERT INTO ${table} (asset_key, file_name, mime_type, image_data, sha256, sort_order, active)
          VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING ${fields}`,
        [slot.key, image.fileName, image.mimeType, image.buffer, image.sha256, slot.position])).rows[0]
        return { image: mapImage(row), duplicate: false }
      })
    },
    async setActive(id, active, revision) {
      return transaction(async (client) => {
        const row = await current(client, id, revision)
        if (row.active && !active) {
          const { count } = (await client.query(`SELECT count(*)::integer AS count FROM ${table} WHERE active`)).rows[0]
          if (count <= 1) throw new CampaignImageError(409, 'LAST_ACTIVE_IMAGE', 'Activa otra imagen antes de desactivar esta: debe quedar al menos una para los envíos.')
        }
        const updated = (await client.query(`UPDATE ${table} SET active = $2, updated_at = now() WHERE asset_key = $1 RETURNING ${fields}`, [id, active])).rows[0]
        return { image: mapImage(updated) }
      })
    },
    async replace(id, file, revision) {
      const image = await validateCampaignImage(file)
      return transaction(async (client) => {
        await current(client, id, revision)
        const duplicate = (await client.query(`SELECT asset_key FROM ${table} WHERE sha256 = $1 AND asset_key <> $2`, [image.sha256, id])).rows[0]
        if (duplicate) throw new CampaignImageError(409, 'DUPLICATE_IMAGE', 'Esa imagen ya está en la biblioteca. Puedes activar la existente.')
        const row = (await client.query(`UPDATE ${table} SET file_name = $2, mime_type = $3, image_data = $4, sha256 = $5,
          updated_at = now() WHERE asset_key = $1 RETURNING ${fields}`, [id, image.fileName, image.mimeType, image.buffer, image.sha256])).rows[0]
        return { image: mapImage(row) }
      })
    },
    async content(id, thumbnail = false) {
      validId(id)
      let row
      try {
        row = (await pool.query(`SELECT file_name, mime_type, image_data, sha256 FROM ${table} WHERE asset_key = $1`, [id])).rows[0]
      } catch (error) {
        if (error.code !== '42P01') throw error
      }
      if (!row) throw new CampaignImageError(404, 'IMAGE_NOT_FOUND', 'No se encontró la imagen.')
      if (!thumbnail) return { bytes: row.image_data, mimeType: row.mime_type, fileName: row.file_name }
      let bytes = thumbnails.get(row.sha256)
      if (!bytes) {
        try {
          bytes = await sharp(row.image_data, sharpOptions).rotate().resize({ width: 560, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 78 }).toBuffer()
        } catch { throw new CampaignImageError(422, 'INVALID_IMAGE', 'No se puede mostrar la miniatura de esta imagen. Puedes descargarla o sustituirla.') }
        if (thumbnails.size >= 100) thumbnails.delete(thumbnails.keys().next().value)
        thumbnails.set(row.sha256, bytes)
      }
      return { bytes, mimeType: 'image/webp', fileName: 'miniatura.webp' }
    },
  }
}
