import type {
  Availability,
  ListenOptions,
  ListenResult,
  SpeechEngine,
} from './SpeechEngine'

type SpeechRecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  processLocally?: boolean
  phrases?: unknown[]
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null
  onerror: ((ev: { error: string }) => void) | null
  onend: (() => void) | null
  onspeechstart: (() => void) | null
  onnomatch: (() => void) | null
}

interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: {
      isFinal: boolean
      length: number
      [index: number]: { transcript: string; confidence: number }
    }
  }
}

interface SpeechRecognitionStatic {
  available?: (opts: {
    langs: string[]
    processLocally: boolean
  }) => Promise<'available' | 'downloading' | 'downloadable' | 'unavailable'>
  install?: (opts: {
    langs: string[]
    processLocally?: boolean
    quality?: string
  }) => Promise<boolean>
}

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor & SpeechRecognitionStatic
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

function getSpeechRecognitionStatic(): SpeechRecognitionStatic | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor & SpeechRecognitionStatic
  }
  return w.SpeechRecognition ?? null
}

function mapAvailability(
  value: 'available' | 'downloading' | 'downloadable' | 'unavailable',
): Availability {
  if (value === 'available') return 'ready'
  if (value === 'downloadable' || value === 'downloading') return 'downloadable'
  return 'unavailable'
}

/**
 * Chrome on-device Web Speech API engine.
 * Never starts recognition without confirmed on-device support.
 */
export function createChromeOnDeviceEngine(): SpeechEngine {
  let active: SpeechRecognitionLike | null = null
  let cancelled = false

  return {
    id: 'chrome-on-device',
    label: 'Chrome on-device (Web Speech)',

    async checkAvailability(): Promise<Availability> {
      const staticApi = getSpeechRecognitionStatic()
      if (!staticApi || typeof staticApi.available !== 'function') {
        return 'unavailable'
      }
      try {
        const result = await staticApi.available({
          langs: ['en-US'],
          processLocally: true,
        })
        return mapAvailability(result)
      } catch {
        return 'unavailable'
      }
    },

    async prepare(onProgress): Promise<void> {
      const status = await this.checkAvailability()
      if (status === 'ready') {
        onProgress(100, 'Language pack ready')
        return
      }
      if (status === 'unavailable') {
        throw new Error('On-device speech recognition is unavailable')
      }
      const staticApi = getSpeechRecognitionStatic()
      if (!staticApi?.install) {
        throw new Error('SpeechRecognition.install is not available')
      }
      onProgress(0, 'Installing language pack…')
      // API does not expose granular progress
      const ok = await staticApi.install({
        langs: ['en-US'],
        processLocally: true,
      })
      if (!ok) {
        throw new Error('Language pack install failed')
      }
      onProgress(100, 'Language pack installed')
    },

    async listen(opts: ListenOptions): Promise<ListenResult> {
      cancelled = false
      const availability = await this.checkAvailability()
      if (availability !== 'ready') {
        throw new Error(
          `Chrome on-device engine not ready (availability=${availability}). Refusing to start remote recognition.`,
        )
      }

      const Ctor = getRecognitionCtor()
      const staticApi = getSpeechRecognitionStatic()
      if (!Ctor || !staticApi?.available) {
        throw new Error('SpeechRecognition constructor unavailable')
      }

      const listenStarted = performance.now()
      let speechHeard = false
      let finalTranscript = ''
      const alternatives: string[] = []
      let confidence: number | undefined

      return new Promise<ListenResult>((resolve, reject) => {
        const recognition = new Ctor()
        active = recognition
        recognition.lang = 'en-US'
        recognition.continuous = opts.manualStop === true
        recognition.interimResults = true
        recognition.maxAlternatives = 3
        recognition.processLocally = true

        // Contextual biasing when supported
        const w = window as unknown as {
          SpeechRecognitionPhrase?: new (
            phrase: string,
            boost?: number,
          ) => unknown
        }
        if (w.SpeechRecognitionPhrase && opts.phrases?.length) {
          recognition.phrases = opts.phrases.map(
            (p) => new w.SpeechRecognitionPhrase!(p, 10),
          )
        }

        const maxTimer = window.setTimeout(() => {
          recognition.stop()
        }, opts.maxMs)

        const noSpeechTimer = window.setTimeout(() => {
          if (!speechHeard && !opts.manualStop) {
            recognition.abort()
            cleanup()
            resolve({
              transcript: '',
              alternatives: [],
              noSpeech: true,
              listenMs: Math.round(performance.now() - listenStarted),
              processMs: 0,
              engineId: 'chrome-on-device',
            })
          }
        }, opts.noSpeechMs)

        const cleanup = () => {
          window.clearTimeout(maxTimer)
          window.clearTimeout(noSpeechTimer)
          active = null
        }

        recognition.onspeechstart = () => {
          speechHeard = true
        }

        recognition.onresult = (ev) => {
          speechHeard = true
          const finals: string[] = []
          for (let i = 0; i < ev.results.length; i++) {
            const best = ev.results[i]?.[0]
            if (ev.results[i]?.isFinal && best) finals.push(best.transcript.trim())
          }
          finalTranscript = finals.join(' ')
          for (let i = ev.resultIndex; i < ev.results.length; i++) {
            const result = ev.results[i]
            if (!result) continue
            if (result.isFinal) {
              const best = result[0]
              if (best) {
                confidence = best.confidence
              }
              alternatives.length = 0
              for (let a = 0; a < result.length; a++) {
                const alt = result[a]
                if (alt?.transcript) alternatives.push(alt.transcript.trim())
              }
            }
          }
        }

        recognition.onerror = (ev) => {
          cleanup()
          if (cancelled || ev.error === 'aborted') {
            resolve({
              transcript: finalTranscript,
              alternatives,
              confidence,
              noSpeech: !finalTranscript,
              listenMs: Math.round(performance.now() - listenStarted),
              processMs: 0,
              engineId: 'chrome-on-device',
            })
            return
          }
          if (ev.error === 'no-speech') {
            resolve({
              transcript: '',
              noSpeech: true,
              listenMs: Math.round(performance.now() - listenStarted),
              processMs: 0,
              engineId: 'chrome-on-device',
            })
            return
          }
          reject(new Error(`SpeechRecognition error: ${ev.error}`))
        }

        recognition.onend = () => {
          cleanup()
          const listenMs = Math.round(performance.now() - listenStarted)
          resolve({
            transcript: finalTranscript,
            alternatives: alternatives.filter((a) => a !== finalTranscript),
            confidence,
            noSpeech: !finalTranscript,
            listenMs,
            processMs: 0,
            engineId: 'chrome-on-device',
          })
        }

        try {
          recognition.start()
        } catch (err) {
          cleanup()
          reject(err instanceof Error ? err : new Error(String(err)))
        }
      })
    },

    stop(): void {
      try {
        active?.stop()
      } catch {
        return
      }
    },

    cancel(): void {
      cancelled = true
      try {
        active?.abort()
      } catch {
        /* ignore */
      }
      active = null
    },
  }
}
