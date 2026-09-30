// Mail policy and legacy CSV webhook limits, shared with both workflow generators.
// Larger dashboard imports use campaign-import-policy.mjs and streamed SQL intake.
// Provider throughput stays configurable; campaign size is not a daily limit.
export const campaignPolicy = Object.freeze({
  max_csv_rows: 10_000,
  max_csv_bytes: 10 * 1024 * 1024,
  max_emails_per_day: 2000,
  max_emails_per_hour: 300,
  min_send_interval_seconds: 2,
  max_sends_per_run: 10,
  timezone: 'Europe/Madrid',
  business_window_start: '08:30',
  business_window_end: '17:00',
  continue_next_business_day: true,
})
