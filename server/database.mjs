import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const databasePath = process.env.KAAM_DATABASE_PATH
  ? resolve(process.env.KAAM_DATABASE_PATH)
  : resolve(projectRoot, 'data', 'kaam.sqlite')

mkdirSync(dirname(databasePath), { recursive: true })

export const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('admin', 'operator')),
    status TEXT NOT NULL CHECK (status IN ('active', 'disabled')),
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS users_status_role_idx ON users(status, role);
  CREATE INDEX IF NOT EXISTS sessions_expire_idx ON sessions(expire);
`)

const publicUserFields = `
  id,
  email,
  display_name AS displayName,
  role,
  status,
  created_at AS createdAt,
  updated_at AS updatedAt,
  last_login_at AS lastLoginAt
`

export const userQueries = {
  count: db.prepare('SELECT COUNT(*) AS total FROM users'),
  countActiveAdmins: db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'admin' AND status = 'active'"),
  findById: db.prepare(`SELECT ${publicUserFields}, password_hash AS passwordHash FROM users WHERE id = ?`),
  findPublicById: db.prepare(`SELECT ${publicUserFields} FROM users WHERE id = ?`),
  findByEmail: db.prepare(`SELECT ${publicUserFields}, password_hash AS passwordHash FROM users WHERE email = ? COLLATE NOCASE`),
  list: db.prepare(`SELECT ${publicUserFields} FROM users ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, display_name COLLATE NOCASE`),
  insert: db.prepare(`
    INSERT INTO users (id, email, display_name, role, status, password_hash, created_at, updated_at)
    VALUES (@id, @email, @displayName, @role, @status, @passwordHash, @createdAt, @updatedAt)
  `),
  updateProfile: db.prepare(`
    UPDATE users
    SET email = @email, display_name = @displayName, role = @role, status = @status,
        password_hash = COALESCE(@passwordHash, password_hash), updated_at = @updatedAt
    WHERE id = @id
  `),
  touchLogin: db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?'),
  delete: db.prepare('DELETE FROM users WHERE id = ?'),
  deleteSessionsForUser: db.prepare("DELETE FROM sessions WHERE json_extract(sess, '$.userId') = ?"),
}

export const databasePathForDisplay = databasePath
