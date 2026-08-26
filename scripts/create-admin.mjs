import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'
import { closeDatabase, databasePathForDisplay, initializeDatabase, userQueries } from '../server/database.mjs'
import { hashPassword } from '../server/security.mjs'

function readArgument(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : undefined
}

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('La contraseña debe introducirse desde una terminal interactiva.')
  }

  return new Promise((resolve, reject) => {
    let value = ''
    stdout.write(prompt)
    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    const finish = () => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
      stdout.write('\n')
      resolve(value)
    }

    const onData = (chunk) => {
      for (const character of chunk) {
        if (character === '\u0003') {
          stdin.setRawMode(false)
          stdin.removeListener('data', onData)
          reject(new Error('Operación cancelada.'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length) {
            value = value.slice(0, -1)
            stdout.write('\b \b')
          }
          continue
        }
        if (character >= ' ') {
          value += character
          stdout.write('•')
        }
      }
    }

    stdin.on('data', onData)
  })
}

const rl = createInterface({ input: stdin, output: stdout })

try {
  await initializeDatabase()
  const defaultEmail = readArgument('email') || 'alex.benito@kaam.es'
  const defaultName = readArgument('name') || 'Alex Benito'
  const email = (await rl.question(`Correo del administrador [${defaultEmail}]: `)).trim().toLowerCase() || defaultEmail
  const displayName = (await rl.question(`Nombre visible [${defaultName}]: `)).trim() || defaultName
  rl.close()

  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new Error('El correo no es válido.')
  if (displayName.length < 2 || displayName.length > 80) throw new Error('El nombre debe tener entre 2 y 80 caracteres.')
  if (await userQueries.findByEmail(email)) throw new Error('Ya existe un usuario con ese correo.')

  const password = await readHidden('Contraseña inicial: ')
  const confirmation = await readHidden('Repite la contraseña: ')
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.')
  if (password.length < 12 || password.length > 128) throw new Error('La contraseña inicial debe tener entre 12 y 128 caracteres.')

  const now = new Date().toISOString()
  await userQueries.insert({
    id: randomUUID(),
    email,
    displayName,
    role: 'admin',
    status: 'active',
    passwordHash: await hashPassword(password),
    createdAt: now,
    updatedAt: now,
  })

  stdout.write(`Administrador creado en ${databasePathForDisplay}\n`)
} catch (error) {
  rl.close()
  process.exitCode = 1
  console.error(error.message)
} finally {
  await closeDatabase()
}
