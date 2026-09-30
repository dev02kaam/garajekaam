export type CsvSummaryData = { rows: number; valid: number; issues: number; columns: string[]; skipped: { invalid_email: number; duplicate_email: number; opted_out: number } }
export class CampaignCsvReader {
  push(bytes: Uint8Array): Record<string, unknown>[]
  finish(): Record<string, unknown>[]
  summary(): CsvSummaryData
}
