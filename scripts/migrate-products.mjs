import { readFile } from 'node:fs/promises'
import { pool } from '../server/database.mjs'

try {
  await pool.query(await readFile(new URL('../migrations/001_deca_campaign_email_assets.sql', import.meta.url), 'utf8'))
  console.log('Biblioteca de DECA preparada. No se han habilitado automatizaciones.')
} finally { await pool.end() }
