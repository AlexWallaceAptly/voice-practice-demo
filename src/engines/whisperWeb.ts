import {
  LISTEN_MAX_MS,
  LISTEN_NO_SPEECH_MS,
  WHISPER_END_SILENCE_MS,
  WHISPER_MODEL,
  WHISPER_SILENCE_RMS,
} from '../config'
import {
  blobTo16kMono,
  computeRms,
  startRecorder,
  type RecorderHandle,
} from './recorder'
import type {
  Availability,
  ListenOptions,
  ListenResult,
  SpeechEngine,
} from './SpeechEngine'

interface WorkerProgress {
  type: 'progress'
  pct: number
  note?: string
}

interface WorkerPrepared {
  type: 'prepared'
  device: string
}

interface WorkerResult {
  type: 'result'
  requestId: string
  transcript: string
  processMs: number
  device: string
}

interface WorkerError {
  type: 'error'
  message: string
}

type WorkerMsg = WorkerProgress | WorkerPrepared | WorkerResult | WorkerError

/**
 * Whisper via Transformers.js in a Web Worker.
 * Capture first, then transcribe. Gate on energy to avoid hallucinations.
 */
export function createWhisperWebEngine(): SpeechEngine {
  let worker: Worker | null = null
  let prepared = false
  let recorder: RecorderHandle | null = null
  let cancelled = false
  let finishNow: (() => void) | null = null

  const ensureWorker = () => {
    if (!worker) {
      worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
        type: 'module',
      })
    }
    return worker
  }

  return {
    id: 'whisper-web',
    label: 'Whisper (in-browser)',

    async checkAvailability(): Promise<Availability> {
      // Always downloadable in supporting browsers; model may already be cached.
      if (typeof Worker === 'undefined' || typeof OfflineAudioContext === 'undefined') {
        return 'unavailable'
      }
      return prepared ? 'ready' : 'downloadable'
    },

    async prepare(onProgress): Promise<void> {
      const w = ensureWorker()
      await new Promise<void>((resolve, reject) => {
        const onMessage = (ev: MessageEvent<WorkerMsg>) => {
          const msg = ev.data
          if (msg.type === 'progress') {
            onProgress(msg.pct, msg.note)
          } else if (msg.type === 'prepared') {
            w.removeEventListener('message', onMessage)
            prepared = true
            onProgress(100, `Ready (${msg.device})`)
            resolve()
          } else if (msg.type === 'error') {
            w.removeEventListener('message', onMessage)
            reject(new Error(msg.message))
          }
        }
        w.addEventListener('message', onMessage)
        w.postMessage({ type: 'prepare', modelId: WHISPER_MODEL })
      })
    },

    async listen(opts: ListenOptions): Promise<ListenResult> {
      cancelled = false
      const maxMs = opts.maxMs ?? LISTEN_MAX_MS
      const noSpeechMs = opts.noSpeechMs ?? LISTEN_NO_SPEECH_MS
      const listenStarted = performance.now()

      recorder = await startRecorder()
      let speechStarted = false
      let lastLoudAt = performance.now()
      let stopped = false

      // Continuously capture by stopping when silence detected after speech
      // MediaRecorder collects the blob; we also poll RMS from the meter.
      const waitForEnd = new Promise<Blob>((resolve, reject) => {
        const hardCap = window.setTimeout(() => {
          finish()
        }, maxMs)

        const noSpeechCap = window.setTimeout(() => {
          if (!speechStarted && !opts.manualStop) {
            finish(true)
          }
        }, noSpeechMs)

        const poll = window.setInterval(() => {
          if (!recorder || stopped) return
          const { rms } = recorder.getLevel()
          if (rms >= WHISPER_SILENCE_RMS) {
            speechStarted = true
            lastLoudAt = performance.now()
          } else if (
            !opts.manualStop &&
            speechStarted &&
            performance.now() - lastLoudAt >= WHISPER_END_SILENCE_MS
          ) {
            finish()
          }
        }, 50)

        finishNow = () => void finish()

        async function finish(asNoSpeech = false) {
          if (stopped) return
          stopped = true
          finishNow = null
          window.clearTimeout(hardCap)
          window.clearTimeout(noSpeechCap)
          window.clearInterval(poll)
          try {
            if (!recorder) {
              resolve(new Blob())
              return
            }
            if (asNoSpeech || cancelled) {
              recorder.cancel()
              recorder = null
              resolve(new Blob())
              return
            }
            const blob = await recorder.stop()
            recorder = null
            resolve(blob)
          } catch (err) {
            reject(err)
          }
        }
      })

      const blob = await waitForEnd
      const listenMs = Math.round(performance.now() - listenStarted)

      if (cancelled || blob.size === 0) {
        return {
          transcript: '',
          noSpeech: true,
          listenMs,
          processMs: 0,
          engineId: 'whisper-web',
        }
      }

      const samples = await blobTo16kMono(blob)
      const rms = computeRms(samples)
      if (rms < WHISPER_SILENCE_RMS) {
        return {
          transcript: '',
          noSpeech: true,
          listenMs,
          processMs: 0,
          engineId: 'whisper-web',
        }
      }

      const w = ensureWorker()
      const requestId = crypto.randomUUID()

      const result = await new Promise<WorkerResult>((resolve, reject) => {
        const onMessage = (ev: MessageEvent<WorkerMsg>) => {
          const msg = ev.data
          if (msg.type === 'result' && msg.requestId === requestId) {
            w.removeEventListener('message', onMessage)
            resolve(msg)
          } else if (msg.type === 'error') {
            w.removeEventListener('message', onMessage)
            reject(new Error(msg.message))
          }
        }
        w.addEventListener('message', onMessage)
        // Transfer the underlying buffer for speed
        w.postMessage(
          { type: 'transcribe', audio: samples, modelId: WHISPER_MODEL, requestId },
          [samples.buffer],
        )
      })

      prepared = true
      return {
        transcript: result.transcript,
        noSpeech: result.transcript.length === 0,
        listenMs,
        processMs: result.processMs,
        engineId: 'whisper-web',
      }
    },

    stop(): void {
      finishNow?.()
    },

    cancel(): void {
      cancelled = true
      recorder?.cancel()
      recorder = null
    },
  }
}
