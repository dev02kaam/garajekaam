// Large files are streamed into PostgreSQL. These limits do not change mail quotas.
export const campaignImportPolicy = Object.freeze({
  maxBytes: 100 * 1024 * 1024,
  maxRows: 1_000_000,
  maxColumns: 100,
  maxRecordCharacters: 256 * 1024,
  batchSize: 500,
  legacyMaxBytes: 10 * 1024 * 1024,
  legacyMaxRows: 10_000,
  requestTimeoutMs: 15 * 60 * 1000,
})
