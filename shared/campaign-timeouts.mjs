// Allow large CSV imports to be acknowledged before the browser gives up.
// The browser budget includes time to upload the file and return the API result.
export const CAMPAIGN_WEBHOOK_TIMEOUT_MS = 120_000
export const CAMPAIGN_REQUEST_TIMEOUT_MS = CAMPAIGN_WEBHOOK_TIMEOUT_MS + 30_000
