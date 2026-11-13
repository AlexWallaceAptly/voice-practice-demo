/// <reference lib="webworker" />
import { pipeline, env } from '@huggingface/transformers'

env.allowLocalModels = false

type ProgressCallback = (pct: number, note?: string) => void

let transcriber: Awaited<ReturnType<typeof pipeline>> | null = null
let loadedModel = ''
let loadedDevice = ''

async function detectDevice(): Promise<'webgpu' | 'wasm'> {
  try {
    const nav = self.navigator as Navigator & {
      gpu?: { requestAdapter: () => Promise<unknown> }
    }
    if (!nav.gpu) return 'wasm'
    const adapter = await nav.gpu.requestAdapter()
    return adapter ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

async function loadModel(
  modelId: string,
  onProgress: ProgressCallback,
): Promise<void> {
  if (transcriber && loadedModel === modelId) {
    onProgress(100, `Model ready (${loadedDevice})`)
    return
  }

  let device = await detectDevice()
  onProgress(5, `Loading on ${device}…`)

  const progress_callback = (data: {
    status?: string
    progress?: number
    file?: string
  }) => {
    if (typeof data.progress === 'number') {
      onProgress(
        Math.min(99, Math.round(data.progress)),
        data.file ? `Downloading ${data.file}` : data.status,
      )
    }
  }

  try {
    transcriber = await pipeline('automatic-speech-recognition', modelId, {
      device,
      dtype: device === 'webgpu' ? 'q4' : 'q8',
      progress_callback,
    })
  } catch (err) {
    if (device === 'webgpu') {
      device = 'wasm'
      onProgress(10, 'WebGPU failed; falling back to WASM…')
      transcriber = await pipeline('automatic-speech-recognition', modelId, {
        device: 'wasm',
        dtype: 'q8',
        progress_callback,
      })
    } else {
      throw err
    }
  }

  loadedModel = modelId
  loadedDevice = device
  onProgress(100, `Model ready (${device})`)
}

self.onmessage = async (ev: MessageEvent) => {
  const msg = ev.data as
    | { type: 'prepare'; modelId: string }
    | {
        type: 'transcribe'
        audio: Float32Array
        modelId: string
        requestId: string
      }
    | { type: 'cancel' }

  try {
    if (msg.type === 'prepare') {
      await loadModel(msg.modelId, (pct, note) => {
        self.postMessage({ type: 'progress', pct, note })
      })
      self.postMessage({ type: 'prepared', device: loadedDevice })
      return
    }

    if (msg.type === 'transcribe') {
      const processStarted = performance.now()
      if (!transcriber || loadedModel !== msg.modelId) {
        await loadModel(msg.modelId, (pct, note) => {
          self.postMessage({ type: 'progress', pct, note })
        })
      }
      const run = transcriber as unknown as (
        audio: Float32Array,
        options: { language: string; task: string },
      ) => Promise<{ text?: string }>
      const result = await run(msg.audio, {
        language: 'english',
        task: 'transcribe',
      })
      const processMs = Math.round(performance.now() - processStarted)
      self.postMessage({
        type: 'result',
        requestId: msg.requestId,
        transcript: (result.text ?? '').trim(),
        processMs,
        device: loadedDevice,
      })
      return
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    })
  }
}

export {}
