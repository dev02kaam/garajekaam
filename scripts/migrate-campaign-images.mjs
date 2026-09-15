import { pool, workflowSchemaSql } from '../server/database.mjs'

// Additive repair for the original campaign_email_assets update trigger.
// Does not upload, activate, replace or remove any campaign image.
try {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SET LOCAL lock_timeout = '5s'")
    const inventory = `SELECT asset_key, sha256, active, sort_order, file_name FROM ${workflowSchemaSql}.campaign_email_assets ORDER BY asset_key`
    const before = JSON.stringify((await client.query(inventory)).rows)
    await client.query(`ALTER TABLE ${workflowSchemaSql}.campaign_email_assets ADD COLUMN IF NOT EXISTS row_version bigint NOT NULL DEFAULT 1`)
    if (before !== JSON.stringify((await client.query(inventory)).rows)) throw new Error('El inventario cambió durante la migración; se cancela la operación.')
    await client.query('COMMIT')
    console.log('Biblioteca preparada para gestionar imágenes. Archivos y selección conservados.')
  } catch (error) { await client.query('ROLLBACK'); throw error }
  finally { client.release() }
} finally { await pool.end() }
