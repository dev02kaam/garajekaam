import assert from 'node:assert/strict'
import { after, before, beforeEach, test } from 'node:test'
import { randomUUID } from 'node:crypto'
import express from 'express'
import pg from 'pg'
import sharp from 'sharp'
import { createCampaignImageStore, validateCampaignImage, MAX_IMAGE_BYTES } from '../server/campaign-images.mjs'
import { campaignImageRouter } from '../server/campaign-image-routes.mjs'

if (!process.env.CAMPAIGN_IMAGES_TEST_DATABASE_URL) throw new Error('Configura CAMPAIGN_IMAGES_TEST_DATABASE_URL con una base de pruebas desechable.')
const pool = new pg.Pool({ connectionString: process.env.CAMPAIGN_IMAGES_TEST_DATABASE_URL })
const schema = `images_test_${randomUUID().replaceAll('-', '')}`
const table = `"${schema}".campaign_email_assets`
const store = createCampaignImageStore(pool, schema)
let server, origin, first, second
const file = (buffer, name = 'campaña.png', mimetype = 'image/png') => ({ buffer, originalname: name, mimetype })
const picture = (color, format = 'png') => sharp({ create: { width: 240, height: 160, channels: 3, background: color } }).toFormat(format).toBuffer()

before(async () => {
  await pool.query(`CREATE SCHEMA "${schema}"`)
  await pool.query(`CREATE TABLE ${table} (
    asset_key text PRIMARY KEY CHECK (asset_key ~ '^ficharia-campana-[0-9]{2}$'),
    file_name text NOT NULL CHECK (octet_length(file_name) BETWEEN 5 AND 180 AND position('/' IN file_name)=0 AND position(chr(92) IN file_name)=0),
    mime_type text NOT NULL CHECK (mime_type IN ('image/png','image/jpeg','image/webp')),
    image_data bytea NOT NULL CHECK (octet_length(image_data) BETWEEN 100 AND 10485760),
    sha256 char(64) NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    sort_order smallint NOT NULL UNIQUE CHECK (sort_order BETWEEN 1 AND 100),
    active boolean NOT NULL DEFAULT true, row_version bigint NOT NULL DEFAULT 1, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now())`)
  await pool.query(`CREATE FUNCTION "${schema}".touch() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN NEW.updated_at := clock_timestamp(); NEW.row_version := OLD.row_version + 1; RETURN NEW; END; $$;
    CREATE TRIGGER asset_touch BEFORE UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION "${schema}".touch()`)
  first = await picture('#a94b33')
  second = await picture('#255c67')
  const app = express()
  app.use(express.json())
  app.use('/images', campaignImageRouter({ store,
    authenticate: (req, res, next) => req.get('X-Test-Session') === 'operator' ? next() : res.status(401).json({ code: 'SESSION_EXPIRED' }),
    protectCsrf: (req, res, next) => req.get('X-CSRF-Token') === 'test-csrf' ? next() : res.status(403).json({ code: 'INVALID_CSRF' }),
  }))
  app.use((error, _req, res, _next) => res.status(500).json({ code: 'INTERNAL_ERROR', message: error.message }))
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve))
  await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`)
  await pool.end()
})
beforeEach(async () => { await pool.query(`DELETE FROM ${table}`) })

async function call(path = '', init = {}, authenticated = true) {
  return fetch(origin + '/images' + path, { ...init, headers: { ...(authenticated ? { 'X-Test-Session': 'operator' } : {}), ...init.headers } })
}
function form(buffer = first, name = 'campaña.png', revision) {
  const data = new FormData()
  data.append('image', new Blob([buffer], { type: 'image/png' }), name)
  if (revision) data.append('revision', revision)
  return data
}
const rejectCode = (code) => (error) => error.code === code

test('lista vacía y almacenamiento no configurado son estados distintos', async () => {
  assert.deepEqual(await store.list(), { available: true, images: [] })
  assert.deepEqual(await createCampaignImageStore(pool, 'schema_absent').list(), { available: false, images: [] })
})
test('sube una imagen inactiva, conserva el original y devuelve metadata sin bytes', async () => {
  const result = await store.upload(file(first))
  assert.equal(result.duplicate, false)
  assert.equal(result.image.active, false)
  assert.equal(result.image.fileName, 'campaña.png')
  assert.equal(result.image.sizeBytes, first.length)
  assert.deepEqual((await store.content(result.image.id)).bytes, first)
  assert.equal(JSON.stringify(await store.list()).includes(first.toString('base64')), false)
  const preview = await store.content(result.image.id, true)
  const dimensions = await sharp(preview.bytes).metadata()
  assert.equal(preview.mimeType, 'image/webp')
  assert.ok(dimensions.width <= 560 && dimensions.height <= 360)
})
test('reintentos y subidas simultáneas del mismo archivo no duplican ni reactivan', async () => {
  const results = await Promise.all([store.upload(file(first)), store.upload(file(first))])
  assert.equal(results.filter((item) => item.duplicate).length, 1)
  assert.equal(results[0].image.id, results[1].image.id)
  assert.equal((await store.list()).images.length, 1)
  assert.equal(results[1].image.active, false)
})
test('archivos distintos concurrentes reciben claves y posiciones únicas', async () => {
  const results = await Promise.all([store.upload(file(first)), store.upload(file(second))])
  assert.notEqual(results[0].image.id, results[1].image.id)
  assert.notEqual(results[0].image.sortOrder, results[1].image.sortOrder)
})
test('la consulta usada por el envío solo obtiene imágenes activas', async () => {
  const one = (await store.upload(file(first))).image
  await store.upload(file(second))
  await store.setActive(one.id, true, one.revision)
  const rows = (await pool.query(`SELECT asset_key, image_data FROM ${table} WHERE active ORDER BY sort_order, asset_key`)).rows
  assert.equal(rows.length, 1)
  assert.equal(rows[0].asset_key, one.id)
  assert.deepEqual(rows[0].image_data, first)
})
test('desactivar conserva el archivo, y la última imagen activa queda protegida incluso con concurrencia', async () => {
  const one = (await store.upload(file(first))).image
  const two = (await store.upload(file(second))).image
  const a = (await store.setActive(one.id, true, one.revision)).image
  const b = (await store.setActive(two.id, true, two.revision)).image
  const results = await Promise.allSettled([store.setActive(a.id, false, a.revision), store.setActive(b.id, false, b.revision)])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'LAST_ACTIVE_IMAGE')
  assert.equal((await store.list()).images.filter((image) => image.active).length, 1)
  assert.deepEqual((await store.content(a.id)).bytes, first)
})
test('sustituir conserva clave, posición y estado activo; actualiza original y miniatura', async () => {
  const one = (await store.upload(file(first))).image
  const active = (await store.setActive(one.id, true, one.revision)).image
  const oldThumbnail = (await store.content(one.id, true)).bytes
  const replaced = (await store.replace(one.id, file(second, 'nueva.png'), active.revision)).image
  assert.equal(replaced.id, active.id)
  assert.equal(replaced.sortOrder, active.sortOrder)
  assert.equal(replaced.active, true)
  assert.notEqual(replaced.sha256, active.sha256)
  assert.notEqual(replaced.revision, active.revision)
  assert.deepEqual((await store.content(one.id)).bytes, second)
  assert.notDeepEqual((await store.content(one.id, true)).bytes, oldThumbnail)
})
test('sustitución duplicada y revisiones antiguas no sobrescriben cambios', async () => {
  const one = (await store.upload(file(first))).image
  await store.upload(file(second))
  await assert.rejects(store.replace(one.id, file(second), one.revision), rejectCode('DUPLICATE_IMAGE'))
  const active = (await store.setActive(one.id, true, one.revision)).image
  await assert.rejects(store.replace(one.id, file(second), one.revision), rejectCode('IMAGE_CHANGED'))
  await assert.rejects(store.setActive(one.id, false, one.revision), rejectCode('IMAGE_CHANGED'))
  assert.equal((await store.list()).images[0].revision, active.revision)
  assert.deepEqual((await store.content(one.id)).bytes, first)
})
test('rechaza SVG disfrazado, PNG truncado, MIME incorrecto y archivos demasiado grandes', async () => {
  for (const buffer of [Buffer.from('<svg>' + ' '.repeat(150) + '</svg>'), first.subarray(0, 110)]) {
    await assert.rejects(store.upload(file(buffer)), rejectCode('INVALID_IMAGE'))
  }
  await assert.rejects(store.upload(file(first, 'x.jpg', 'image/jpeg')), rejectCode('IMAGE_TYPE_MISMATCH'))
  await assert.rejects(store.upload(file(Buffer.alloc(MAX_IMAGE_BYTES + 1))), rejectCode('IMAGE_TOO_LARGE'))
  assert.equal((await store.list()).images.length, 0)
})
test('normaliza nombres de Windows y limita su longitud en bytes', async () => {
  const result = await validateCampaignImage(file(first, 'C:\\Fotos\\' + 'á'.repeat(200) + '\r\n.png'))
  assert.ok(Buffer.byteLength(result.fileName) <= 180)
  assert.doesNotMatch(result.fileName, /[\\/\r\n]/)
})
test('admite JPEG y WebP reales', async () => {
  for (const format of ['jpeg', 'webp']) {
    // Texture keeps the valid WebP above the existing database minimum of 100 bytes.
    const bytes = await sharp(first).composite([{ input: second, blend: 'difference' }]).toFormat(format, { quality: 100 }).toBuffer()
    const result = await validateCampaignImage(file(bytes, `ejemplo.${format}`, `image/${format}`))
    assert.equal(result.mimeType, `image/${format}`)
  }
})
test('HTTP exige sesión y CSRF tanto en subida como sustitución y activación', async () => {
  assert.equal((await call('', {}, false)).status, 401)
  assert.equal((await call('/ficharia-campana-01/file', {}, false)).status, 401)
  for (const [method, path, body] of [['POST', '', form()], ['PUT', '/ficharia-campana-01', form()], ['PATCH', '/ficharia-campana-01', '{}']]) {
    assert.equal((await call(path, { method, body })).status, 403)
  }
})
test('HTTP sube, detecta duplicado, activa y descarga los bytes originales', async () => {
  const headers = { 'X-CSRF-Token': 'test-csrf' }
  const response = await call('', { method: 'POST', headers, body: form() })
  assert.equal(response.status, 201)
  const { image } = await response.json()
  assert.equal(image.fileName, 'campaña.png')
  assert.equal((await call('', { method: 'POST', headers, body: form() })).status, 200)
  const active = await call('/' + image.id, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ active: true, revision: image.revision }) })
  assert.equal(active.status, 200)
  const download = await call('/' + image.id + '/file?download=1')
  assert.equal(download.status, 200)
  assert.match(download.headers.get('content-disposition'), /^attachment;/)
  assert.equal(download.headers.get('cache-control'), 'private, no-store')
  assert.equal(download.headers.get('content-type'), 'image/png')
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), first)
})
test('HTTP sustituye por multipart y devuelve errores explícitos para ID/archivo/campos inválidos', async () => {
  const headers = { 'X-CSRF-Token': 'test-csrf' }
  const one = (await store.upload(file(first))).image
  const result = await call('/' + one.id, { method: 'PUT', headers, body: form(second, 'sustituta.png', one.revision) })
  assert.equal(result.status, 200)
  assert.equal((await result.json()).image.fileName, 'sustituta.png')
  assert.equal((await call('/invalid/file')).status, 400)
  assert.equal((await call('/ficharia-campana-99/file')).status, 404)
  assert.equal((await call('', { method: 'POST', headers, body: new FormData() })).status, 400)
  const oversized = await call('', { method: 'POST', headers, body: form(Buffer.alloc(MAX_IMAGE_BYTES + 1)) })
  assert.equal(oversized.status, 413)
  assert.equal((await oversized.json()).code, 'INVALID_IMAGE_UPLOAD')
  const invalid = await call('/' + one.id, { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ active: 'false', revision: one.revision }) })
  assert.equal(invalid.status, 400)
})
