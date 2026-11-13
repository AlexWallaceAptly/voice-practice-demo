export type PlaybackSpeed = 0.75 | 1 | 1.25

export interface PlayOptions {
  speed?: PlaybackSpeed
  onEnded?: () => void
  onError?: (err: Error) => void
}

/**
 * Audio playback helper with speed, preloading, and optional Media Session hooks.
 */
export class AudioPlayer {
  private current: HTMLAudioElement | null = null
  private preloadEl: HTMLAudioElement | null = null
  private speed: PlaybackSpeed = 1
  private usingPlaceholder = false

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed
    if (this.current) this.current.playbackRate = speed
  }

  getSpeed(): PlaybackSpeed {
    return this.speed
  }

  isUsingPlaceholder(): boolean {
    return this.usingPlaceholder
  }

  async probe(url: string): Promise<boolean> {
    try {
      // Prefer GET: some hosts (Vite SPA fallback) return 200 HTML for HEAD.
      const res = await fetch(url, { method: 'GET', cache: 'force-cache' })
      if (!res.ok) return false
      const type = res.headers.get('content-type') ?? ''
      if (type.startsWith('audio/') || type.includes('mpeg') || type.includes('mp4')) {
        return true
      }
      // Empty or binary without a clear type — treat as present if not HTML/JSON
      if (type.includes('text/html') || type.includes('application/json')) {
        return false
      }
      // Fallback: tiny non-HTML body check
      const buf = await res.arrayBuffer()
      return buf.byteLength > 0 && type !== 'text/html'
    } catch {
      return false
    }
  }

  preload(url: string): void {
    if (this.preloadEl) {
      this.preloadEl.src = ''
      this.preloadEl = null
    }
    const el = new Audio()
    el.preload = 'auto'
    el.src = url
    this.preloadEl = el
  }

  async playUrl(url: string, options: PlayOptions = {}): Promise<void> {
    this.stop()
    this.usingPlaceholder = false
    const speed = options.speed ?? this.speed

    const exists = await this.probe(url)
    if (!exists) {
      if (import.meta.env.DEV) {
        throw new Error('AUDIO_MISSING')
      }
      throw new Error(`Audio not found: ${url}`)
    }

    await new Promise<void>((resolve, reject) => {
      const el = new Audio(url)
      el.playbackRate = speed
      this.current = el
      el.onended = () => {
        options.onEnded?.()
        resolve()
      }
      el.onerror = () => {
        const err = new Error(`Failed to play ${url}`)
        options.onError?.(err)
        reject(err)
      }
      void el.play().catch(reject)
    })
  }

  /**
   * Dev-only fallback: speak text with speechSynthesis.
   * Must only be called when import.meta.env.DEV is true.
   */
  playPlaceholderText(text: string, options: PlayOptions = {}): Promise<void> {
    if (!import.meta.env.DEV) {
      return Promise.reject(new Error('Placeholder voice disabled in production'))
    }
    this.stop()
    this.usingPlaceholder = true
    const speed = options.speed ?? this.speed

    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        reject(new Error('speechSynthesis unavailable'))
        return
      }
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.rate = speed
      u.lang = 'en-US'
      u.onend = () => {
        options.onEnded?.()
        resolve()
      }
      u.onerror = () => {
        const err = new Error('Placeholder speech failed')
        options.onError?.(err)
        reject(err)
      }
      window.speechSynthesis.speak(u)
    })
  }

  pause(): void {
    this.current?.pause()
    if (this.usingPlaceholder && 'speechSynthesis' in window) {
      window.speechSynthesis.pause()
    }
  }

  resume(): void {
    void this.current?.play()
    if (this.usingPlaceholder && 'speechSynthesis' in window) {
      window.speechSynthesis.resume()
    }
  }

  stop(): void {
    if (this.current) {
      this.current.onended = null
      this.current.pause()
      this.current.src = ''
      this.current = null
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    this.usingPlaceholder = false
  }

  bindMediaSession(handlers: {
    play?: () => void
    pause?: () => void
    nexttrack?: () => void
    previoustrack?: () => void
  }): void {
    if (!('mediaSession' in navigator)) return
    const ms = navigator.mediaSession
    if (handlers.play) {
      ms.setActionHandler('play', handlers.play)
    }
    if (handlers.pause) {
      ms.setActionHandler('pause', handlers.pause)
    }
    if (handlers.nexttrack) {
      ms.setActionHandler('nexttrack', handlers.nexttrack)
    }
    if (handlers.previoustrack) {
      ms.setActionHandler('previoustrack', handlers.previoustrack)
    }
  }

  setMediaMetadata(title: string, artist = 'Voice Practice Demo'): void {
    if (!('mediaSession' in navigator)) return
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist,
    })
  }
}

export async function playQuestionOrPlaceholder(
  player: AudioPlayer,
  audioPath: string,
  promptText: string,
  onPlaceholder?: () => void,
): Promise<void> {
  const url = audioPath.startsWith('/') ? audioPath : `/${audioPath}`
  try {
    await player.playUrl(url)
  } catch (err) {
    if (
      import.meta.env.DEV &&
      err instanceof Error &&
      (err.message === 'AUDIO_MISSING' || err.message.includes('not found'))
    ) {
      onPlaceholder?.()
      await player.playPlaceholderText(promptText)
      return
    }
    throw err
  }
}
