export interface RecorderLevel {
  /** 0–1 instantaneous level */
  level: number
  rms: number
}

export interface RecorderHandle {
  stop: () => Promise<Blob>
  cancel: () => void
  getLevel: () => RecorderLevel
  stream: MediaStream
}

function pickMimeType(): string | undefined {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]
  for (const c of candidates) {
    if (
      typeof MediaRecorder !== 'undefined' &&
      MediaRecorder.isTypeSupported(c)
    ) {
      return c
    }
  }
  return undefined
}

export interface MicMeter {
  stream: MediaStream
  getLevel: () => RecorderLevel
  close: () => void
}

export async function openMicMeter(
  onLevel?: (level: RecorderLevel) => void,
): Promise<MicMeter> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  })

  const audioCtx = new AudioContext()
  const source = audioCtx.createMediaStreamSource(stream)
  const analyser = audioCtx.createAnalyser()
  analyser.fftSize = 2048
  source.connect(analyser)
  const timeData = new Float32Array(analyser.fftSize)

  let level: RecorderLevel = { level: 0, rms: 0 }
  let raf = 0

  const tick = () => {
    analyser.getFloatTimeDomainData(timeData)
    let sum = 0
    for (let i = 0; i < timeData.length; i++) {
      const v = timeData[i] ?? 0
      sum += v * v
    }
    const rms = Math.sqrt(sum / timeData.length)
    level = { level: Math.min(1, rms * 4), rms }
    onLevel?.(level)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    stream,
    getLevel: () => level,
    close: () => {
      cancelAnimationFrame(raf)
      source.disconnect()
      void audioCtx.close()
      for (const track of stream.getTracks()) track.stop()
    },
  }
}

/**
 * Open the mic, return a live level meter and a stop() that yields a Blob.
 */
export async function startRecorder(
  onLevel?: (level: RecorderLevel) => void,
): Promise<RecorderHandle> {
  const meter = await openMicMeter(onLevel)
  const { stream } = meter

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType } : undefined,
  )
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data)
  }
  recorder.start(100)

  const cleanup = meter.close

  return {
    stream,
    getLevel: meter.getLevel,
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } catch {
        /* ignore */
      }
      cleanup()
    },
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          cleanup()
          resolve(
            new Blob(chunks, {
              type: mimeType ?? 'audio/webm',
            }),
          )
        }
        if (recorder.state !== 'inactive') recorder.stop()
        else {
          cleanup()
          resolve(new Blob(chunks, { type: mimeType ?? 'audio/webm' }))
        }
      }),
  }
}

/** Decode a recorded Blob to mono Float32Array at 16 kHz. */
export async function blobTo16kMono(blob: Blob): Promise<Float32Array> {
  const arrayBuffer = await blob.arrayBuffer()
  const ctx = new AudioContext()
  const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0))
  await ctx.close()

  const channel = decoded.getChannelData(0)
  const targetRate = 16_000
  if (decoded.sampleRate === targetRate) {
    return new Float32Array(channel)
  }

  const duration = decoded.duration
  const offline = new OfflineAudioContext(
    1,
    Math.ceil(duration * targetRate),
    targetRate,
  )
  const buffer = offline.createBuffer(1, channel.length, decoded.sampleRate)
  buffer.copyToChannel(channel, 0)
  const src = offline.createBufferSource()
  src.buffer = buffer
  src.connect(offline.destination)
  src.start(0)
  const rendered = await offline.startRendering()
  return new Float32Array(rendered.getChannelData(0))
}

export function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    const v = samples[i] ?? 0
    sum += v * v
  }
  return Math.sqrt(sum / samples.length)
}
