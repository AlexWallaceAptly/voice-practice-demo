export type Availability = 'ready' | 'downloadable' | 'unavailable'

export interface ListenOptions {
  /** Vocabulary hints, used if the engine supports biasing */
  phrases?: string[]
  /** Hard cap, default 15000 */
  maxMs: number
  /** Give up if nothing heard, default 8000 */
  noSpeechMs: number
}

export interface ListenResult {
  transcript: string
  alternatives?: string[]
  confidence?: number
  noSpeech: boolean
  listenMs: number
  processMs: number
  engineId: string
}

export interface SpeechEngine {
  id: string
  label: string
  checkAvailability(): Promise<Availability>
  /** Download model or language pack */
  prepare(onProgress: (pct: number, note?: string) => void): Promise<void>
  listen(opts: ListenOptions): Promise<ListenResult>
  cancel(): void
}
