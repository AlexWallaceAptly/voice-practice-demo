import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BackLink } from '../components/BackLink'
import { useQuestions } from '../hooks/useQuestions'
import { resolveDefaultEngine, getEngineById, allEngines } from '../engines'
import { setOfflineReady, setPreferredEngine, loadPreferredEngine } from '../lib/storage'
import { useDevMode } from '../hooks/useDevMode'

type StepStatus = 'idle' | 'running' | 'done' | 'error'

async function cacheAudioFiles(
  urls: string[],
  onProgress: (pct: number, note: string) => void,
): Promise<void> {
  const cache = await caches.open('audio-cache')
  let done = 0
  for (const url of urls) {
    const absolute = url.startsWith('/') ? url : `/${url}`
    try {
      const existing = await cache.match(absolute)
      if (!existing) {
        const res = await fetch(absolute)
        if (res.ok) {
          await cache.put(absolute, res.clone())
        }
      }
    } catch {
      // Missing studio files are expected in dev; continue.
    }
    done += 1
    onProgress(
      Math.round((done / urls.length) * 100),
      `Cached ${done} of ${urls.length} audio files`,
    )
  }
}

export function Setup() {
  const { questions, loading, error } = useQuestions()
  const dev = useDevMode()
  const [audioStatus, setAudioStatus] = useState<StepStatus>('idle')
  const [engineStatus, setEngineStatus] = useState<StepStatus>('idle')
  const [audioPct, setAudioPct] = useState(0)
  const [enginePct, setEnginePct] = useState(0)
  const [note, setNote] = useState('')
  const [engineNote, setEngineNote] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [engineId, setEngineId] = useState(
    () => loadPreferredEngine() ?? '',
  )

  const run = async () => {
    setErrorMsg(null)
    setAudioStatus('running')
    setEngineStatus('idle')
    setOfflineReady(false)

    try {
      const urls = questions.flatMap((q) => [q.questionAudio, q.answerAudio])
      await cacheAudioFiles(urls, (pct, n) => {
        setAudioPct(pct)
        setNote(n)
      })
      setAudioStatus('done')

      setEngineStatus('running')
      const preferred = engineId || loadPreferredEngine()
      const { engine } =
        preferred
          ? {
              engine: getEngineById(preferred),
            }
          : await resolveDefaultEngine()

      setEngineId(engine.id)
      setPreferredEngine(engine.id)

      const availability = await engine.checkAvailability()
      if (availability === 'unavailable') {
        // Try the other engine
        const fallback = allEngines().find((e) => e.id !== engine.id)
        if (!fallback) throw new Error('No speech engine available')
        setEngineId(fallback.id)
        setPreferredEngine(fallback.id)
        await fallback.prepare((pct, n) => {
          setEnginePct(pct)
          setEngineNote(n ?? '')
        })
      } else {
        await engine.prepare((pct, n) => {
          setEnginePct(pct)
          setEngineNote(n ?? '')
        })
      }

      setEngineStatus('done')
      setOfflineReady(true)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err))
      if (audioStatus !== 'done') setAudioStatus('error')
      setEngineStatus('error')
    }
  }

  return (
    <div className="space-y-5">
      <BackLink />
      <h1 className="m-0 text-2xl font-bold">Prepare for offline</h1>
      <p className="m-0 text-slate-600">
        Download question audio and prepare the speech engine once. After this,
        you can turn the network off and still use all three options.
      </p>

      {dev && (
        <label className="block text-sm">
          Preferred engine
          <select
            className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
            value={engineId}
            onChange={(e) => {
              setEngineId(e.target.value)
              setPreferredEngine(e.target.value)
            }}
          >
            <option value="">Auto (Chrome on-device, else Whisper)</option>
            {allEngines().map((e) => (
              <option key={e.id} value={e.id}>
                {e.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {loading && <p>Loading questions…</p>}
      {error && <p className="text-red-700">{error}</p>}

      <ol className="space-y-3 p-0 list-none">
        <li className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">1. Cache all audio</span>
            <StatusPill status={audioStatus} />
          </div>
          {audioStatus === 'running' && (
            <>
              <Progress pct={audioPct} />
              <p className="mt-1 mb-0 text-xs text-slate-500">{note}</p>
            </>
          )}
        </li>
        <li className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">2. Prepare speech engine</span>
            <StatusPill status={engineStatus} />
          </div>
          {engineStatus === 'running' && (
            <>
              <Progress pct={enginePct} indeterminate={enginePct === 0} />
              <p className="mt-1 mb-0 text-xs text-slate-500">{engineNote}</p>
            </>
          )}
          {engineId && engineStatus === 'done' && (
            <p className="mt-2 mb-0 text-xs text-slate-500">Engine: {engineId}</p>
          )}
        </li>
      </ol>

      {errorMsg && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errorMsg}
        </p>
      )}

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={loading || questions.length === 0}
          onClick={() => void run()}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 disabled:opacity-50"
        >
          Start setup
        </button>
        {audioStatus === 'done' && engineStatus === 'done' && (
          <Link
            to="/"
            className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-900 no-underline"
          >
            Done — back to home
          </Link>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }: { status: StepStatus }) {
  const map = {
    idle: 'bg-slate-100 text-slate-600',
    running: 'bg-sky-100 text-sky-800',
    done: 'bg-emerald-100 text-emerald-800',
    error: 'bg-red-100 text-red-800',
  }
  const label = {
    idle: 'Waiting',
    running: 'Working…',
    done: 'Ready',
    error: 'Failed',
  }
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>
      {label[status]}
    </span>
  )
}

function Progress({
  pct,
  indeterminate,
}: {
  pct: number
  indeterminate?: boolean
}) {
  return (
    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full bg-sky-600 ${
          indeterminate ? 'w-1/3 animate-pulse' : ''
        }`}
        style={indeterminate ? undefined : { width: `${pct}%` }}
      />
    </div>
  )
}
