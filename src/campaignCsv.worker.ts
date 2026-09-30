import { CampaignCsvReader } from '../shared/campaign-csv.mjs'

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const file = event.data
    const parser = new CampaignCsvReader()
    for (let offset = 0; offset < file.size; offset += 64 * 1024) {
      parser.push(new Uint8Array(await file.slice(offset, offset + 64 * 1024).arrayBuffer()))
      if (offset % (1024 * 1024) === 0) self.postMessage({ progress: Math.floor(offset / file.size * 100) })
    }
    parser.finish()
    self.postMessage({ summary: { filename: file.name, ...parser.summary() } })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'No se pudo leer el CSV.' })
  }
}
