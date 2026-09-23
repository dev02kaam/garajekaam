// Shared by the dashboard and the workflow generator for both products.
// Provider throughput stays configurable; campaign size is not a daily limit.
export const campaignPolicy = Object.freeze({
  max_csv_rows: 10_000,
  max_csv_bytes: 10 * 1024 * 1024,
  max_emails_per_day: 5_000,
  max_emails_per_hour: 150,
  min_send_interval_seconds: 30,
  max_sends_per_run: 10,
  timezone: 'Europe/Madrid',
  business_window_start: '10:00',
  business_window_end: '17:00',
  continue_next_business_day: true,
})
