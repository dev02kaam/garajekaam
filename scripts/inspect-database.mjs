import pg from 'pg'

if (!process.env.DATABASE_URL?.trim()) {
  throw new Error('DATABASE_URL no está configurada.')
}

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'disable'
    ? false
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' },
  max: 1,
})

try {
  const [meta, schemas, relations, views] = await Promise.all([
    pool.query("SELECT current_database() AS database, current_user AS role, current_setting('server_version') AS version"),
    pool.query(`
      SELECT schemaname AS schema, count(*)::integer AS tables
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      GROUP BY schemaname
      ORDER BY schemaname
    `),
    pool.query(`
      SELECT table_schema AS schema, table_name AS name, table_type AS type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name
    `),
    pool.query(`
      SELECT schemaname AS schema, viewname AS name
      FROM pg_views
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY schemaname, viewname
    `),
  ])

  process.stdout.write(`${JSON.stringify({
    connection: meta.rows[0],
    schemas: schemas.rows,
    relations: relations.rows,
    views: views.rows,
  }, null, 2)}\n`)
} finally {
  await pool.end()
}
