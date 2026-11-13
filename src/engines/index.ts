import { loadPreferredEngine } from '../lib/storage'
import { createChromeOnDeviceEngine } from './chromeOnDevice'
import type { Availability, SpeechEngine } from './SpeechEngine'
import { createWhisperWebEngine } from './whisperWeb'

export function allEngines(): SpeechEngine[] {
  return [createChromeOnDeviceEngine(), createWhisperWebEngine()]
}

export function getEngineById(id: string): SpeechEngine {
  const engine = allEngines().find((e) => e.id === id)
  if (!engine) throw new Error(`Unknown engine: ${id}`)
  return engine
}

/**
 * Default: chromeOnDevice if ready or downloadable, otherwise whisperWeb.
 * Dev panel / preferred engine override when set.
 */
export async function resolveDefaultEngine(): Promise<{
  engine: SpeechEngine
  availability: Availability
}> {
  const preferred = loadPreferredEngine()
  if (preferred) {
    const engine = getEngineById(preferred)
    const availability = await engine.checkAvailability()
    return { engine, availability }
  }

  const chrome = createChromeOnDeviceEngine()
  const chromeAvail = await chrome.checkAvailability()
  if (chromeAvail === 'ready' || chromeAvail === 'downloadable') {
    return { engine: chrome, availability: chromeAvail }
  }

  const whisper = createWhisperWebEngine()
  const whisperAvail = await whisper.checkAvailability()
  return { engine: whisper, availability: whisperAvail }
}

export type { SpeechEngine, Availability, ListenResult, ListenOptions } from './SpeechEngine'
