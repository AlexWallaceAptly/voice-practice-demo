import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  QUESTION_SETS,
  SIM_PASS_PERCENT,
  SIM_QUESTION_COUNT,
} from '../config'
import { isOfflineReady, loadQuestionSet, saveQuestionSet } from '../lib/storage'

const options = [
  {
    to: '/listen',
    title: 'Option 1: Listen',
    blurb:
      'Hear the question, think, hear the answer, auto-advance. Hands-free. No microphone.',
    effort: 'Low effort · No speech recognition',
  },
  {
    to: '/speak',
    title: 'Option 2: Speak & Self-Check',
    blurb:
      'Say the answer aloud, reveal the correct answer, and grade yourself. Recording stays on this device.',
    effort: 'Low–medium · Records only',
  },
  {
    to: '/mock',
    title: 'Option 3: Mock Interview',
    blurb:
      'Say the answer; the app grades it with on-device speech recognition. Closest to a real interview.',
    effort: 'Higher effort · Needs on-device recognition',
  },
]

export function Home() {
  const offlineReady = isOfflineReady()
  const [questionSet, setQuestionSet] = useState(loadQuestionSet)

  return (
    <div className="space-y-6">
      <section>
        <h1 className="m-0 text-2xl font-bold tracking-tight sm:text-3xl">
          Try three ways to practice with voice
        </h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          This demo lets leadership compare Listen, Speak & Self-Check, and Mock
          Interview before we build the React Native app. After a one-time setup,
          everything works offline. No cloud speech, no API keys, no backend.
        </p>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          to="/setup"
          className="inline-flex items-center rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white no-underline hover:bg-sky-800"
        >
          Prepare for offline
        </Link>
        <Link
          to="/results"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 no-underline hover:bg-slate-50"
        >
          View results & export
        </Link>
      </div>

      {!offlineReady && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Tip: run <strong>Prepare for offline</strong> once so Mock Interview
          and audio work with the network off.
        </p>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="m-0 text-base font-semibold">Question set</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {QUESTION_SETS.map((set) => (
            <label
              key={set.id}
              className={`flex cursor-pointer gap-3 rounded-xl border p-3 text-sm ${
                questionSet === set.id
                  ? 'border-sky-400 bg-sky-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <input
                type="radio"
                name="question-set"
                checked={questionSet === set.id}
                onChange={() => {
                  saveQuestionSet(set.id)
                  setQuestionSet(set.id)
                }}
              />
              <span>
                <span className="block font-medium">{set.label}</span>
                <span className="block text-slate-600">{set.blurb}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-1">
        {options.map((opt) => (
          <Link
            key={opt.to}
            to={opt.to}
            className="block rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 no-underline shadow-sm transition hover:border-sky-300 hover:shadow-md"
          >
            <h2 className="m-0 text-lg font-semibold">{opt.title}</h2>
            <p className="mt-2 mb-0 text-sm text-slate-600">{opt.blurb}</p>
            <p className="mt-3 mb-0 text-xs font-medium uppercase tracking-wide text-slate-400">
              {opt.effort}
            </p>
          </Link>
        ))}
      </div>

      <p className="text-xs text-slate-500">
        Mock Interview demo settings (unconfirmed): ask up to{' '}
        {SIM_QUESTION_COUNT} questions, pass at {SIM_PASS_PERCENT}%. Confirm the
        real USCIS 2025 format before sharing with leadership.
      </p>
    </div>
  )
}
