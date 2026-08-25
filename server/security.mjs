import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const KEY_LENGTH = 64
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }

export async function hashPassword(password) {
  const salt = randomBytes(18)
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS)
  return [
    'scrypt',
    SCRYPT_OPTIONS.N,
    SCRYPT_OPTIONS.r,
    SCRYPT_OPTIONS.p,
    salt.toString('base64url'),
    Buffer.from(derived).toString('base64url'),
  ].join('$')
}

export async function verifyPassword(password, encodedHash) {
  const [algorithm, rawN, rawR, rawP, rawSalt, rawHash] = String(encodedHash).split('$')
  if (algorithm !== 'scrypt' || !rawN || !rawR || !rawP || !rawSalt || !rawHash) return false

  const expected = Buffer.from(rawHash, 'base64url')
  if (expected.length !== KEY_LENGTH) return false

  const actual = await scrypt(password, Buffer.from(rawSalt, 'base64url'), KEY_LENGTH, {
    N: Number(rawN),
    r: Number(rawR),
    p: Number(rawP),
    maxmem: 64 * 1024 * 1024,
  })

  return timingSafeEqual(expected, Buffer.from(actual))
}

