import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  INCLUDE_DYNAMIC_IN_SIM,
  LISTEN_NO_SPEECH_MS,
  MANUAL_LISTEN_MAX_MS,
  SIM_PASS_PERCENT,
  SIM_QUESTION_COUNT,
} from '../config'
import { AudioPlayer, playQuestionOrPlaceholder } from '../audio/player'
import { BackLink } from '../components/BackLink'
import { DevEnginePanel } from '../components/DevEnginePanel'
import { FeedbackPrompt } from '../components/FeedbackPrompt'
import { LevelMeter } from '../components/LevelMeter'
import {
  createInitialSessionState,
  isCorrect,
  reduceSession,
  selectSimQuestions,
  sessionResultsToAttempts,
  type SessionState,
} from '../core/session'
import type { Question } from '../core/types'
import { resolveDefaultEngine, type SpeechEngine } from '../engines'
import { openMicMeter } from '../engines/recorder'
import { useDevMode } from '../hooks/useDevMode'
import { useQuestions } from '../hooks/useQuestions'
import { appendAttempts, isOfflineReady } from '../lib/storage'

export function MockInterview() {
  const { questions, loading, error } = useQuestions()
  const dev = useDevMode()
  const playerRef = useRef(new AudioPlayer())
  const engineRef = useRef<SpeechEngine | null>(null)

  const [state, setState] = useState<SessionState>(createInitialSessionState)
  const [deck, setDeck] = useState<Question[]>([])
  const [engineLabel, setEngineLabel] = useState('')
  const [engineReady, setEngineReady] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [micOpen, setMicOpen] = useState(false)
  const [micLevel, setMicLevel] = useState(0)
  const [placeholder, setPlaceholder] = useState(false)
  const [lastListenMs, setLastListenMs] = useState<number>()
  const [lastProcessMs, setLastProcessMs] = useState<number>()
  const [err, setErr] = useState<string | null>(null)
  const loggedRef = useRef(false)

  const current = deck[state.index]

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const { engine, availability } = await resolveDefaultEngine()
        if (cancelled) return
        engineRef.current = engine
        setEngineLabel(engine.label)

        if (availability === 'ready') {
          setEngineReady(true)
          return
        }

        // After Setup, Whisper may report downloadable again in a new instance
        // even though the model is cached — warm it if offline setup completed.
        if (availability === 'downloadable' && isOfflineReady()) {
          await engine.prepare(() => undefined)
          if (cancelled) return
          const again = await engine.checkAvailability()
          setEngineReady(again === 'ready')
          return
        }

        setEngineReady(false)
      } catch (e) {
        if (!cancelled) {
          setEngineReady(false)
          setErr(e instanceof Error ? e.message : String(e))
        }
      }
    })()
    return () => {
      cancelled = true
      playerRef.current.stop()
      engineRef.current?.cancel()
    }
  }, [])

  useEffect(() => {
    if (!micOpen) return
    let closed = false
    let close: (() => void) | null = null
    void openMicMeter((l) => setMicLevel(l.level))
      .then((meter) => {
        if (closed) meter.close()
        else close = meter.close
      })
      .catch(() => undefined)
    return () => {
      closed = true
      close?.()
      setMicLevel(0)
    }
  }, [micOpen])

  useEffect(() => {
    if (state.phase === 'SUMMARY' && !loggedRef.current) {
      loggedRef.current = true
      appendAttempts(sessionResultsToAttempts(state.results))
    }
  }, [state.phase, state.results])

  const start = async () => {
    setErr(null)
    loggedRef.current = false
    const engine = engineRef.current
    if (!engine) {
      setErr('No speech engine available')
      return
    }
    const availability = await engine.checkAvailability()
    if (availability !== 'ready') {
      setEngineReady(false)
      return
    }
    const selected = selectSimQuestions(
      questions,
      INCLUDE_DYNAMIC_IN_SIM,
      SIM_QUESTION_COUNT,
    )
    setDeck(selected)
    const next = reduceSession(createInitialSessionState(), {
      type: 'START',
      questionIds: selected.map((q) => q.id),
      engineId: engine.id,
    })
    setState(next)
    queueMicrotask(() => void runQuestion(next, selected))
  }

  const runQuestion = async (s: SessionState, questionsDeck: Question[]) => {
    const q = questionsDeck[s.index]
    const engine = engineRef.current
    if (!q || !engine) return
    setBusy(true)
    setPlaceholder(false)
    try {
      // Mic must NOT be open while question audio plays
      await playQuestionOrPlaceholder(
        playerRef.current,
        q.questionAudio,
        q.prompt,
        () => setPlaceholder(true),
      )
      setState(reduceSession(s, { type: 'QUESTION_PLAY_ENDED' }))
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const onMicTap = async () => {
    const engine = engineRef.current
    if (!current || !engine) return
    if (micOpen) {
      engine.stop()
      return
    }
    setErr(null)
    setMicOpen(true)
    try {
      const result = await engine.listen({
        phrases: current.acceptedAnswers.flatMap((a) => a.variants),
        maxMs: MANUAL_LISTEN_MAX_MS,
        noSpeechMs: LISTEN_NO_SPEECH_MS,
        manualStop: true,
      })
      setLastListenMs(result.listenMs)
      setLastProcessMs(result.processMs)
      setState((prev) =>
        reduceSession(
          prev,
          {
            type: 'LISTEN_RESULT',
            transcript: result.transcript,
            alternatives: result.alternatives,
            noSpeech: result.noSpeech,
            listenMs: result.listenMs,
            processMs: result.processMs,
          },
          current,
        ),
      )
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setMicOpen(false)
    }
  }

  const onReplay = async () => {
    const next = reduceSession(state, { type: 'REQUEST_REPLAY' })
    setState(next)
    if (next.phase === 'PLAYING_QUESTION') {
      await runQuestion(next, deck)
    }
  }

  const onOverride = () => {
    setState(reduceSession(state, { type: 'OVERRIDE_CORRECT' }))
  }

  const onAdvance = async () => {
    const next = reduceSession(state, { type: 'ADVANCE' })
    setState(next)
    if (next.phase === 'PLAYING_QUESTION') {
      await runQuestion(next, deck)
    }
  }

  if (loading) return <p>Loading questions…</p>
  if (error) return <p className="text-red-700">{error}</p>

  if (engineReady === false) {
    return (
      <div className="space-y-4">
        <BackLink />
        <h1 className="m-0 text-2xl font-bold">Mock Interview</h1>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          The speech engine is not ready yet
          {isOfflineReady() ? '' : ' (and offline setup has not been completed)'}.
          Prepare the engine first — we will not fall back to a cloud recognizer.
        </p>
        <Link
          to="/setup"
          className="inline-flex rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white no-underline"
        >
          Go to Setup
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <BackLink />
      <h1 className="m-0 text-2xl font-bold">Mock Interview</h1>
      <p className="m-0 text-sm text-slate-600">
        Up to {SIM_QUESTION_COUNT} questions · pass at {SIM_PASS_PERCENT}%
        (demo placeholders — confirm USCIS 2025 format before leadership
        review). Engine: {engineLabel || '…'}
      </p>

      {placeholder && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Placeholder voice — studio audio not found (dev only).
        </p>
      )}
      {err && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {err}
        </p>
      )}

      {state.phase === 'IDLE' && (
        <button
          type="button"
          disabled={busy || engineReady !== true}
          onClick={() => void start()}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Start interview
        </button>
      )}

      {(state.phase === 'PLAYING_QUESTION' ||
        state.phase === 'LISTENING' ||
        state.phase === 'PROCESSING') &&
        current && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="m-0 text-xs font-medium uppercase tracking-wide text-slate-400">
              Question {state.index + 1} of {deck.length}
            </p>
            <p className="mt-2 text-xl font-semibold">{current.prompt}</p>
            <p className="mt-3 text-sm text-slate-500">
              {state.phase === 'PLAYING_QUESTION' && 'Playing question…'}
              {state.phase === 'PROCESSING' && 'Processing…'}
            </p>
            {state.phase === 'LISTENING' && (
              <MicButton
                open={micOpen}
                level={micLevel}
                onTap={() => void onMicTap()}
              />
            )}
          </div>
        )}

      {state.phase === 'RESULT' && current && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-slate-400">
            Question {state.index + 1} of {deck.length}
          </p>
          <p className="mt-0 text-lg font-semibold">{current.prompt}</p>
          <p className="text-sm">
            <span className="font-medium">Heard:</span>{' '}
            {state.currentTranscript || '(nothing)'}
          </p>
          <p className="text-sm">
            <span className="font-medium">Verdict:</span>{' '}
            <span
              className={
                state.currentVerdict === 'pass'
                  ? 'text-emerald-700'
                  : 'text-rose-700'
              }
            >
              {state.overriddenToCorrect
                ? 'pass (overridden)'
                : state.currentVerdict}
            </span>
          </p>
          {state.currentMatched.length > 0 && (
            <p className="text-sm">
              <span className="font-medium">Matched:</span>{' '}
              {state.currentMatched.join(', ')}
            </p>
          )}
          <div className="text-sm">
            <span className="font-medium">Accepted answers:</span>
            <ul className="mt-1 mb-0 list-disc pl-5">
              {current.acceptedAnswers.map((a) => (
                <li key={a.display}>{a.display}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            {state.currentVerdict === 'no-speech' && !state.replayUsed && (
              <button
                type="button"
                onClick={() => void onReplay()}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
              >
                Replay question
              </button>
            )}
            {state.currentVerdict !== 'pass' && !state.overriddenToCorrect && (
              <button
                type="button"
                onClick={onOverride}
                className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900"
              >
                Mark as correct anyway
              </button>
            )}
            <button
              type="button"
              onClick={() => void onAdvance()}
              className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white"
            >
              {state.index + 1 >= deck.length ? 'See summary' : 'Next question'}
            </button>
          </div>
        </div>
      )}

      {state.phase === 'SUMMARY' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="m-0 text-xl font-semibold">Summary</h2>
            <p className="mt-2 text-sm">
              Score: <strong>{state.scorePercent}%</strong> —{' '}
              {state.passedOverall ? (
                <span className="text-emerald-700">Pass</span>
              ) : (
                <span className="text-rose-700">Needs more practice</span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              Pass bar: {SIM_PASS_PERCENT}% · Engine: {engineLabel}
              {deck.length < SIM_QUESTION_COUNT
                ? ` · Bank has ${deck.length} scored questions (shorter than a full interview).`
                : ''}
            </p>
            <ul className="mt-4 space-y-2 p-0 list-none">
              {state.results.map((r) => {
                const q = deck.find((d) => d.id === r.questionId)
                return (
                  <li
                    key={`${r.questionId}-${r.listenMs}`}
                    className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                  >
                    <p className="m-0 font-medium">{q?.prompt ?? r.questionId}</p>
                    <p className="mt-1 mb-0 text-slate-600">
                      Heard: {r.transcript || '(none)'} ·{' '}
                      {isCorrect(r) ? 'correct' : r.verdict}
                      {r.overriddenToCorrect ? ' (overridden)' : ''} ·{' '}
                      {r.listenMs}ms listen / {r.processMs}ms process
                    </p>
                  </li>
                )
              })}
            </ul>
          </div>
          <FeedbackPrompt mode="mock-interview" />
        </div>
      )}

      {dev && (
        <DevEnginePanel
          engineId={engineRef.current?.id}
          listenMs={lastListenMs}
          processMs={lastProcessMs}
        />
      )}
    </div>
  )
}

function MicButton({
  open,
  level,
  onTap,
}: {
  open: boolean
  level: number
  onTap: () => void
}) {
  return (
    <div className="mt-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onTap}
        aria-label={open ? 'Stop recording' : 'Start recording'}
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition ${
          open ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-700 hover:bg-sky-800'
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
        </svg>
      </button>
      <div className="flex-1 space-y-1">
        <p className="m-0 text-sm text-slate-600">
          {open ? 'Listening… tap to finish' : 'Tap the mic to answer'}
        </p>
        {open && <LevelMeter level={level} />}
      </div>
    </div>
  )
}
