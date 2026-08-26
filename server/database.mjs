import { Buffer } from 'node:buffer'
import pg from 'pg'

const { Pool } = pg

const connectionString = process.env.DATABASE_URL?.trim()
if (!connectionString) {
  throw new Error('DATABASE_URL es obligatorio. Debe apuntar al PostgreSQL compartido con los workflows.')
}

function validIdentifier(value, variableName) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(value)) {
    throw new Error(`${variableName} solo puede contener letras, números y guiones bajos.`)
  }
  return value
}

function quoteIdentifier(value) {
  return `"${value.replaceAll('"', '""')}"`
}

function sslConfiguration() {
  const mode = String(process.env.DATABASE_SSL || 'require').toLowerCase()
  if (mode === 'disable') return false
  if (mode !== 'require') throw new Error('DATABASE_SSL debe ser require o disable.')

  const ca = process.env.DATABASE_SSL_CA_BASE64
    ? Buffer.from(process.env.DATABASE_SSL_CA_BASE64, 'base64').toString('utf8')
    : undefined

  return {
    rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false',
    ...(ca ? { ca } : {}),
  }
}

export const authSchema = validIdentifier(process.env.KAAM_DATABASE_SCHEMA?.trim() || 'garaje_kaam', 'KAAM_DATABASE_SCHEMA')
export const workflowSchema = validIdentifier(process.env.FICHARIA_DATABASE_SCHEMA?.trim() || 'public', 'FICHARIA_DATABASE_SCHEMA')
export const authSchemaSql = quoteIdentifier(authSchema)
export const workflowSchemaSql = quoteIdentifier(workflowSchema)
export const sessionTableName = 'user_sessions'

export const pool = new Pool({
  connectionString,
  ssl: sslConfiguration(),
  application_name: 'garaje-kaam',
  max: Number(process.env.DATABASE_POOL_MAX || 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 8_000,
  statement_timeout: 15_000,
  query_timeout: 16_000,
})

pool.on('error', (error) => {
  console.error('Conexión PostgreSQL inesperadamente interrumpida:', error.message)
})

export async function initializeDatabase() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query("SELECT pg_advisory_xact_lock(hashtext('garaje-kaam-auth-schema-v1'))")
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${authSchemaSql}`)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${authSchemaSql}.users (
        id uuid PRIMARY KEY,
        email text NOT NULL UNIQUE,
        display_name text NOT NULL,
        role text NOT NULL CHECK (role IN ('admin', 'operator')),
        status text NOT NULL CHECK (status IN ('active', 'disabled')),
        password_hash text NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        last_login_at timestamptz,
        CONSTRAINT users_email_normalized_ck CHECK (
          email = lower(btrim(email)) AND octet_length(email) BETWEEN 3 AND 254
        ),
        CONSTRAINT users_display_name_ck CHECK (
          char_length(btrim(display_name)) BETWEEN 2 AND 80
        )
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS users_status_role_idx
      ON ${authSchemaSql}.users (status, role)
    `)
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${authSchemaSql}.${quoteIdentifier(sessionTableName)} (
        sid varchar NOT NULL PRIMARY KEY,
        sess json NOT NULL,
        expire timestamp(6) NOT NULL
      )
    `)
    await client.query(`
      CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
      ON ${authSchemaSql}.${quoteIdentifier(sessionTableName)} (expire)
    `)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

const publicUserFields = `
  id,
  email,
  display_name AS "displayName",
  role,
  status,
  created_at AS "createdAt",
  updated_at AS "updatedAt",
  last_login_at AS "lastLoginAt"
`

function firstRow(result) {
  return result.rows[0] || null
}

export const userQueries = {
  async count() {
    const result = await pool.query(`SELECT count(*)::integer AS total FROM ${authSchemaSql}.users`)
    return result.rows[0].total
  },

  async countActiveAdmins() {
    const result = await pool.query(`
      SELECT count(*)::integer AS total
      FROM ${authSchemaSql}.users
      WHERE role = 'admin' AND status = 'active'
    `)
    return result.rows[0].total
  },

  async findById(id) {
    return firstRow(await pool.query(`
      SELECT ${publicUserFields}, password_hash AS "passwordHash"
      FROM ${authSchemaSql}.users
      WHERE id = $1
    `, [id]))
  },

  async findPublicById(id) {
    return firstRow(await pool.query(`
      SELECT ${publicUserFields}
      FROM ${authSchemaSql}.users
      WHERE id = $1
    `, [id]))
  },

  async findByEmail(email) {
    return firstRow(await pool.query(`
      SELECT ${publicUserFields}, password_hash AS "passwordHash"
      FROM ${authSchemaSql}.users
      WHERE email = lower(btrim($1))
    `, [email]))
  },

  async list() {
    const result = await pool.query(`
      SELECT ${publicUserFields}
      FROM ${authSchemaSql}.users
      ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, display_name
    `)
    return result.rows
  },

  async insert(user) {
    await pool.query(`
      INSERT INTO ${authSchemaSql}.users (
        id, email, display_name, role, status, password_hash,
        created_at, updated_at
      ) VALUES ($1, lower(btrim($2)), btrim($3), $4, $5, $6, $7, $8)
    `, [
      user.id,
      user.email,
      user.displayName,
      user.role,
      user.status,
      user.passwordHash,
      user.createdAt,
      user.updatedAt,
    ])
  },

  async insertInitialAdmin(user) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query("SELECT pg_advisory_xact_lock(hashtext('garaje-kaam-initial-admin-v1'))")
      const count = await client.query(`SELECT count(*)::integer AS total FROM ${authSchemaSql}.users`)
      if (count.rows[0].total > 0) {
        await client.query('COMMIT')
        return false
      }
      await client.query(`
        INSERT INTO ${authSchemaSql}.users (
          id, email, display_name, role, status, password_hash,
          created_at, updated_at
        ) VALUES ($1, lower(btrim($2)), btrim($3), 'admin', 'active', $4, $5, $5)
      `, [user.id, user.email, user.displayName, user.passwordHash, user.createdAt])
      await client.query('COMMIT')
      return true
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },

  async updateProfile(user) {
    await pool.query(`
      UPDATE ${authSchemaSql}.users
      SET email = lower(btrim($2)), display_name = btrim($3), role = $4,
          status = $5, password_hash = COALESCE($6, password_hash), updated_at = $7
      WHERE id = $1
    `, [
      user.id,
      user.email,
      user.displayName,
      user.role,
      user.status,
      user.passwordHash,
      user.updatedAt,
    ])
  },

  async touchLogin(now, id) {
    await pool.query(`
      UPDATE ${authSchemaSql}.users
      SET last_login_at = $1, updated_at = $1
      WHERE id = $2
    `, [now, id])
  },

  async delete(id) {
    await pool.query(`DELETE FROM ${authSchemaSql}.users WHERE id = $1`, [id])
  },

  async deleteSessionsForUser(id) {
    await pool.query(`
      DELETE FROM ${authSchemaSql}.${quoteIdentifier(sessionTableName)}
      WHERE sess->>'userId' = $1
    `, [id])
  },
}

export async function closeDatabase() {
  await pool.end()
}

export const databasePathForDisplay = `${authSchema}.users @ PostgreSQL`
