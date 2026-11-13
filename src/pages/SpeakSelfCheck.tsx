import { useEffect, useMemo, useRef, useState } from 'react'
import { AudioPlayer, playQuestionOrPlaceholder } from '../audio/player'
import { BackLink } from '../components/BackLink'
import { FeedbackPrompt } from '../components/FeedbackPrompt'
import { LevelMeter } from '../components/LevelMeter'
import { createReviewEvent } from '../core/attemptLog'
import {
  categoriesOf,
  filterByCategory,
  shuffleQuestions,
} from '../content/loadQuestions'
import { startRecorder, type RecorderHandle } from '../engines/recorder'
import { useQuestions } from '../hooks/useQuestions'
import { appendReviewEvent } from '../lib/storage'

type Step = 'ready' | 'recording' | 'recorded' | 'revealed'

export function SpeakSelfCheck() {
  const { questions, loading, error } = useQuestions()
  const playerRef = useRef(new AudioPlayer())
  const recorderRef = useRef<RecorderHandle | null>(null)
  const recordingUrl = useRef<string | null>(null)

  const [category, setCategory] = useState('all')
  const [index, setIndex] = useState(0)
  const [step, setStep] = useState<Step>('ready')
  const [level, setLevel] = useState(0)
  const [micDenied, setMicDenied] = useState(false)
  const [placeholder, setPlaceholder] = useState(false)
  const [finished, setFinished] = useState(false)

  const categories = useMemo(() => categoriesOf(questions), [questions])
  const session = useMemo(() => {
    return shuffleQuestions(filterByCategory(questions, category))
  }, [questions, category])
  const current = session[index]

  const discardRecording = () => {
    recorderRef.current?.cancel()
    recorderRef.current = null
    if (recordingUrl.current) {
      URL.revokeObjectURL(recordingUrl.current)
      recordingUrl.current = null
    }
  }

  useEffect(() => {
    return () => {
      playerRef.current.stop()
      discardRecording()
    }
  }, [])

  useEffect(() => {
    // Discard recording when question changes
    discardRecording()
    setStep('ready')
    setLevel(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  const playQuestion = async () => {
    if (!current) return
    setPlaceholder(false)
    await playQuestionOrPlaceholder(
      playerRef.current,
      current.questionAudio,
      current.prompt,
      () => setPlaceholder(true),
    )
  }

  const startRec = async () => {
    try {
      setMicDenied(false)
      const handle = await startRecorder((l) => setLevel(l.level))
      recorderRef.current = handle
      setStep('recording')
    } catch {
      setMicDenied(true)
    }
  }

  const stopRec = async () => {
    if (!recorderRef.current) return
    const blob = await recorderRef.current.stop()
    recorderRef.current = null
    if (recordingUrl.current) URL.revokeObjectURL(recordingUrl.current)
    recordingUrl.current = URL.createObjectURL(blob)
    setStep('recorded')
    setLevel(0)
  }

  const playMyAnswer = () => {
    if (!recordingUrl.current) return
    const audio = new Audio(recordingUrl.current)
    void audio.play()
  }

  const reveal = async () => {
    setStep('revealed')
    if (!current) return
    await playQuestionOrPlaceholder(
      playerRef.current,
      current.answerAudio,
      current.acceptedAnswers.map((a) => a.display).join('. '),
      () => setPlaceholder(true),
    )
  }

  const grade = (result: 'got-it' | 'not-yet') => {
    if (!current) return
    appendReviewEvent(createReviewEvent(current.id, result))
    if (index + 1 >= session.length) {
      setFinished(true)
    } else {
      setIndex((i) => i + 1)
    }
  }

  if (loading) return <p>Loading questions…</p>
  if (error) return <p className="text-red-700">{error}</p>

  return (
    <div className="space-y-5">
      <BackLink />
      <h1 className="m-0 text-2xl font-bold">Speak & Self-Check</h1>
      <p className="m-0 text-sm text-slate-600">
        Say your answer aloud, then reveal and grade yourself. Recordings never
        leave this device.
      </p>

      <label className="flex items-center gap-2 text-sm">
        Category
        <select
          className="rounded-lg border border-slate-300 bg-white px-2 py-1"
          value={category}
          onChange={(e) => {
            setCategory(e.target.value)
            setIndex(0)
            setFinished(false)
          }}
        >
          <option value="all">All</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </label>

      {placeholder && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Placeholder voice — studio audio not found (dev only).
        </p>
      )}

      {micDenied && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Microphone access was denied. You can still say the answer aloud and
          self-grade — recording is optional.
        </p>
      )}

      {current && !finished && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-slate-400">
            Question {index + 1} of {session.length}
            {current.dynamic ? ' · answer may change' : ''}
          </p>
          <p className="mt-2 text-xl font-semibold">{current.prompt}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void playQuestion()}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
            >
              Play question
            </button>
            {step !== 'recording' ? (
              <button
                type="button"
                onClick={() => void startRec()}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white"
              >
                Record answer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void stopRec()}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              >
                Stop
              </button>
            )}
          </div>

          {(step === 'recording' || level > 0) && (
            <div className="mt-3">
              <LevelMeter level={level} />
            </div>
          )}

          {(step === 'recorded' || step === 'revealed' || micDenied) && (
            <div className="mt-4 flex flex-wrap gap-2">
              {recordingUrl.current && (
                <button
                  type="button"
                  onClick={playMyAnswer}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
                >
                  Play my answer
                </button>
              )}
              {step !== 'revealed' && (
                <button
                  type="button"
                  onClick={() => void reveal()}
                  className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white"
                >
                  Reveal answer
                </button>
              )}
            </div>
          )}

          {step === 'revealed' && (
            <div className="mt-4 space-y-3">
              <ul className="m-0 list-disc pl-5 text-sm">
                {current.acceptedAnswers.map((a) => (
                  <li key={a.display}>{a.display}</li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => grade('got-it')}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                >
                  Got it
                </button>
                <button
                  type="button"
                  onClick={() => grade('not-yet')}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
                >
                  Not yet
                </button>
              </div>
            </div>
          )}

          {micDenied && step === 'ready' && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void reveal()}
                className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white"
              >
                Skip recording — reveal answer
              </button>
            </div>
          )}
        </div>
      )}

      {finished && (
        <div className="space-y-4">
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            Session complete.
          </p>
          <FeedbackPrompt mode="speak-self-check" />
        </div>
      )}
    </div>
  )
}
