import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CampaignCsvReader } from '../shared/campaign-csv.mjs'
import { campaignImportPolicy } from '../shared/campaign-import-policy.mjs'

function parse(text, chunk = 11, limits) {
  const reader = new CampaignCsvReader(limits)
  const bytes = Buffer.from(text), contacts = []
  for (let i = 0; i < bytes.length; i += chunk) contacts.push(...reader.push(bytes.subarray(i, i + chunk)))
  contacts.push(...reader.finish())
  return { contacts, ...reader.summary() }
}
test('quoted fields, UTF-8 and CRLF survive every small chunk size and arbitrary column order', () => {
  const csv = '\uFEFFEMAIL;ACTIVIDAD;EMPRESA;CP\r\nA@example.test;"Electricidad; instalaciones";"Compañía ""Norte""\r\ny Sur";02001\r\n'
  for (const size of [1, 2, 3, 7, 64, 65536]) {
    const result = parse(csv, size)
    assert.equal(result.valid, 1)
    assert.equal(result.contacts[0].company, 'Compañía "Norte"\r\ny Sur')
    assert.equal(result.contacts[0].email, 'a@example.test')
    assert.equal(result.contacts[0].cp, '02001')
    assert.equal(result.contacts[0].actividad, 'Electricidad; instalaciones')
  }
})
test('comma/tab separators, aliases, empty rows, invalid email, duplicates and opt-out', () => {
  const result = parse('Razón social,Correo electrónico,No contactar\n"Empresa, Norte",A@example.test,\nEmpresa,a@example.test,\n\nEmpresa,no-email,\nB,b@example.test,si\nC,c@example.test,\n')
  assert.equal(result.rows, 5); assert.equal(result.valid, 2)
  assert.deepEqual(result.skipped, { invalid_email: 1, duplicate_email: 1, opted_out: 1 })
  assert.equal(result.contacts[0].company, 'Empresa, Norte')
  assert.equal(parse('Empresa\tEmail\nNorte\tn@example.test\n').valid, 1)
})
test('malformed files fail explicitly, including errors after valid contacts', () => {
  for (const csv of ['Empresa\nNorte', 'Email;EMAIL\na@example.test;a@example.test', 'Email\na@example.test\n"broken', 'Email;Empresa\na@example.test;Norte;Extra', 'Email\nno-email', 'Email\na@example.test\0']) {
    assert.throws(() => parse(csv), { code: 'INVALID_CSV' })
  }
  assert.throws(() => new CampaignCsvReader().push(Buffer.from([0xff])), { code: 'INVALID_CSV' })
})
test('size, row, column and record limits apply incrementally', () => {
  assert.throws(() => parse('Email\na@example.test', 4, { ...campaignImportPolicy, maxBytes: 10 }), { code: 'INVALID_CSV' })
  assert.throws(() => parse('Email\na@example.test\nb@example.test', 4, { ...campaignImportPolicy, maxRows: 1 }), { code: 'INVALID_CSV' })
  assert.throws(() => parse('Email;Empresa\na@example.test;A', 4, { ...campaignImportPolicy, maxColumns: 1 }), { code: 'INVALID_CSV' })
  assert.throws(() => parse('Email\na@example.test', 4, { ...campaignImportPolicy, maxRecordCharacters: 8 }), { code: 'INVALID_CSV' })
})
test('more than 10,000 rows and 10 MB are streamed without retaining contacts', () => {
  const parser = new CampaignCsvReader()
  parser.push(Buffer.from('Email;Empresa;Actividad\n'))
  let count = 0, bytes = 0
  for (let offset = 0; offset < 25000; offset += 100) {
    const buffer = Buffer.from(Array.from({ length: 100 }, (_, n) => `c${offset + n}@example.test;Empresa ${offset + n};${'x'.repeat(600)}\n`).join(''))
    count += parser.push(buffer).length; bytes += buffer.length
  }
  count += parser.finish().length
  assert(bytes > campaignImportPolicy.legacyMaxBytes)
  assert.equal(count, 25000); assert.equal(parser.summary().valid, count)
})
