import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_THINK_GAP_SEC,
  MAX_THINK_GAP_SEC,
  MIN_THINK_GAP_SEC,
} from '../config'
import {
  AudioPlayer,
  type PlaybackSpeed,
  playQuestionOrPlaceholder,
} from '../audio/player'
import { BackLink } from '../components/BackLink'
import { FeedbackPrompt } from '../components/FeedbackPrompt'
import {
  categoriesOf,
  filterByCategory,
  shuffleQuestions,
} from '../content/loadQuestions'
import type { Question } from '../core/types'
import { useQuestions } from '../hooks/useQuestions'

type Phase = 'idle' | 'question' | 'gap' | 'answer' | 'done'

export function Listen() {
  const { questions, loading, error } = useQuestions()
  const playerRef = useRef(new AudioPlayer())
  const [category, setCategory] = useState('all')
  const [doShuffle, setDoShuffle] = useState(true)
  const [showText, setShowText] = useState(true)
  const [speed, setSpeed] = useState<PlaybackSpeed>(1)
  const [gapSec, setGapSec] = useState(DEFAULT_THINK_GAP_SEC)
  const [session, setSession] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<Phase>('idle')
  const [paused, setPaused] = useState(false)
  const [placeholder, setPlaceholder] = useState(false)
  const [gapLeft, setGapLeft] = useState(0)
  const [finished, setFinished] = useState(false)
  const gapTimer = useRef<number | null>(null)
  const abortRef = useRef(0)
  const pausedRef = useRef(false)
  const gapSecRef = useRef(gapSec)
  const sessionRef = useRef(session)
  const indexRef = useRef(index)

  const categories = useMemo(() => categoriesOf(questions), [questions])

  useEffect(() => {
    gapSecRef.current = gapSec
  }, [gapSec])
  useEffect(() => {
    sessionRef.current = session
  }, [session])
  useEffect(() => {
    indexRef.current = index
  }, [index])
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    if (!questions.length) return
    const filtered = filterByCategory(questions, category)
    setSession(doShuffle ? shuffleQuestions(filtered) : filtered)
    setIndex(0)
    setPhase('idle')
    setFinished(false)
  }, [questions, category, doShuffle])

  const clearGap = () => {
    if (gapTimer.current) {
      window.clearInterval(gapTimer.current)
      gapTimer.current = null
    }
  }

  const stopAll = useCallback(() => {
    abortRef.current += 1
    playerRef.current.stop()
    clearGap()
  }, [])

  useEffect(() => {
    const player = playerRef.current
    player.setSpeed(speed)
    player.bindMediaSession({
      play: () => {
        setPaused(false)
        player.resume()
      },
      pause: () => {
        setPaused(true)
        player.pause()
      },
      nexttrack: () => {
        stopAll()
        setIndex((i) => {
          const next = Math.min(i + 1, sessionRef.current.length - 1)
          return next
        })
        setPhase('idle')
      },
      previoustrack: () => {
        stopAll()
        setIndex((i) => Math.max(0, i - 1))
        setPhase('idle')
        setFinished(false)
      },
    })
    return () => {
      stopAll()
    }
  }, [speed, stopAll])

  useEffect(() => {
    playerRef.current.setSpeed(speed)
  }, [speed])

  const waitGap = (token: number) =>
    new Promise<void>((resolve) => {
      const total = gapSecRef.current
      setGapLeft(total)
      const started = Date.now()
      let pausedAccum = 0
      let pauseStarted: number | null = null
      gapTimer.current = window.setInterval(() => {
        if (token !== abortRef.current) {
          clearGap()
          resolve()
          return
        }
        if (pausedRef.current) {
          if (pauseStarted == null) pauseStarted = Date.now()
          return
        }
        if (pauseStarted != null) {
          pausedAccum += Date.now() - pauseStarted
          pauseStarted = null
        }
        const elapsed = (Date.now() - started - pausedAccum) / 1000
        const left = Math.max(0, total - elapsed)
        setGapLeft(Math.ceil(left))
        if (left <= 0) {
          clearGap()
          resolve()
        }
      }, 200)
    })

  const playFrom = async (startIndex: number) => {
    const token = ++abortRef.current
    const player = playerRef.current
    setFinished(false)

    for (let i = startIndex; i < sessionRef.current.length; i++) {
      if (token !== abortRef.current) return
      const q = sessionRef.current[i]
      if (!q) return
      setIndex(i)
      setPlaceholder(false)

      const next = sessionRef.current[i + 1]
      if (next) {
        const path = next.questionAudio.startsWith('/')
          ? next.questionAudio
          : `/${next.questionAudio}`
        player.preload(path)
      }

      try {
        setPhase('question')
        player.setMediaMetadata(q.prompt)
        await playQuestionOrPlaceholder(
          player,
          q.questionAudio,
          q.prompt,
          () => setPlaceholder(true),
        )
        if (token !== abortRef.current) return

        setPhase('gap')
        await waitGap(token)
        if (token !== abortRef.current) return

        setPhase('answer')
        await playQuestionOrPlaceholder(
          player,
          q.answerAudio,
          q.acceptedAnswers.map((a) => a.display).join('. '),
          () => setPlaceholder(true),
        )
        if (token !== abortRef.current) return
      } catch {
        if (token === abortRef.current) setPhase('idle')
        return
      }
    }

    if (token === abortRef.current) {
      setPhase('done')
      setFinished(true)
    }
  }

  const current = session[index]

  if (loading) return <p>Loading questions…</p>
  if (error) return <p className="text-red-700">{error}</p>
  if (!current && !finished) {
    return (
      <div>
        <BackLink />
        <p>No questions in this category.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <BackLink />
      <h1 className="m-0 text-2xl font-bold">Listen</h1>
      <p className="m-0 text-sm text-slate-600">
        Hands-free practice. No microphone is used in this mode.
      </p>

      <div className="flex flex-wrap gap-3 text-sm">
        <label className="flex items-center gap-2">
          Category
          <select
            className="rounded-lg border border-slate-300 bg-white px-2 py-1"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="all">All</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={doShuffle}
            onChange={(e) => setDoShuffle(e.target.checked)}
          />
          Shuffle
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showText}
            onChange={(e) => setShowText(e.target.checked)}
          />
          Show text
        </label>
        <label className="flex items-center gap-2">
          Speed
          <select
            className="rounded-lg border border-slate-300 bg-white px-2 py-1"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value) as PlaybackSpeed)}
          >
            <option value={0.75}>0.75×</option>
            <option value={1}>1×</option>
            <option value={1.25}>1.25×</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          Think gap
          <input
            type="range"
            min={MIN_THINK_GAP_SEC}
            max={MAX_THINK_GAP_SEC}
            value={gapSec}
            onChange={(e) => setGapSec(Number(e.target.value))}
          />
          <span className="w-8">{gapSec}s</span>
        </label>
      </div>

      {placeholder && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Placeholder voice — studio audio not found (dev only).
        </p>
      )}

      {current && !finished && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-slate-400">
            Question {index + 1} of {session.length}
            {current.dynamic ? ' · answer may change' : ''}
          </p>
          {showText ? (
            <p className="mt-2 text-xl font-semibold">{current.prompt}</p>
          ) : (
            <p className="mt-2 text-xl font-semibold text-slate-400">
              (text hidden)
            </p>
          )}
          <p className="mt-3 text-sm text-slate-500">
            Phase:{' '}
            {phase === 'gap'
              ? `Thinking… ${gapLeft}s`
              : phase === 'question'
                ? 'Playing question'
                : phase === 'answer'
                  ? 'Playing answer'
                  : 'Ready'}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            stopAll()
            void playFrom(index)
          }}
          disabled={phase === 'question' || phase === 'answer' || phase === 'gap'}
          className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {phase === 'idle' || phase === 'done' ? 'Play' : 'Playing…'}
        </button>
        <button
          type="button"
          onClick={() => {
            const player = playerRef.current
            if (paused) {
              setPaused(false)
              player.resume()
            } else {
              setPaused(true)
              player.pause()
            }
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
        >
          {paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={() => {
            stopAll()
            setIndex((i) => Math.max(0, i - 1))
            setPhase('idle')
            setFinished(false)
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => {
            stopAll()
            if (index + 1 >= session.length) {
              setFinished(true)
              setPhase('done')
            } else {
              setIndex((i) => i + 1)
              setPhase('idle')
            }
          }}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
        >
          Next
        </button>
      </div>

      {finished && (
        <div className="space-y-4">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Session complete.
          </p>
          <FeedbackPrompt mode="listen" />
        </div>
      )}
    </div>
  )
}
