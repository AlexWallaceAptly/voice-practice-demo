import { useMemo, useState } from 'react'
import { FEEDBACK_FORM_URL } from '../config'
import { BackLink } from '../components/BackLink'
import { attemptsToCsv, feedbackToCsv } from '../core/attemptLog'
import type { PracticeMode } from '../core/types'
import {
  clearLocalData,
  loadAttempts,
  loadFeedback,
} from '../lib/storage'

const MODE_LABEL: Record<PracticeMode, string> = {
  listen: 'Listen',
  'speak-self-check': 'Speak & Self-Check',
  'mock-interview': 'Mock Interview',
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function Results() {
  const [tick, setTick] = useState(0)
  const feedback = useMemo(() => loadFeedback(), [tick])
  const attempts = useMemo(() => loadAttempts(), [tick])

  const byMode = (mode: PracticeMode) =>
    feedback.filter((f) => f.mode === mode)

  const avg = (mode: PracticeMode) => {
    const rows = byMode(mode)
    if (!rows.length) return null
    return (
      rows.reduce((s, r) => s + r.rating, 0) / rows.length
    ).toFixed(1)
  }

  const shipCounts = (mode: PracticeMode) => {
    const rows = byMode(mode)
    return {
      yes: rows.filter((r) => r.wouldShip === 'yes').length,
      maybe: rows.filter((r) => r.wouldShip === 'maybe').length,
      no: rows.filter((r) => r.wouldShip === 'no').length,
    }
  }

  const overrideRate = () => {
    if (!attempts.length) return null
    const overrides = attempts.filter((a) => a.overriddenToCorrect).length
    return `${Math.round((overrides / attempts.length) * 100)}% (${overrides}/${attempts.length})`
  }

  return (
    <div className="space-y-5">
      <BackLink />
      <h1 className="m-0 text-2xl font-bold">Results</h1>
      <p className="m-0 text-sm text-slate-600">
        Feedback and attempt logs stay on this device. Export them to share with
        the team.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {(Object.keys(MODE_LABEL) as PracticeMode[]).map((mode) => {
          const ships = shipCounts(mode)
          return (
            <div
              key={mode}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h2 className="m-0 text-base font-semibold">{MODE_LABEL[mode]}</h2>
              <p className="mt-2 mb-0 text-sm text-slate-600">
                Avg rating: <strong>{avg(mode) ?? '—'}</strong>
              </p>
              <p className="mt-1 mb-0 text-xs text-slate-500">
                Ship: yes {ships.yes} · maybe {ships.maybe} · no {ships.no}
              </p>
              <p className="mt-1 mb-0 text-xs text-slate-500">
                {byMode(mode).length === 1
                  ? '1 response'
                  : `${byMode(mode).length} responses`}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="m-0 text-base font-semibold">Mock Interview accuracy</h2>
        <p className="mt-2 mb-0 text-sm text-slate-600">
          Override rate (key accuracy signal):{' '}
          <strong>{overrideRate() ?? '—'}</strong>
        </p>
        <p className="mt-1 mb-0 text-xs text-slate-500">
          {attempts.length === 1
            ? '1 logged attempt'
            : `${attempts.length} logged attempts`}
        </p>
      </div>

      {feedback.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="m-0 text-base font-semibold">Recent comments</h2>
          <ul className="mt-3 space-y-2 p-0 list-none">
            {feedback
              .slice()
              .reverse()
              .slice(0, 10)
              .map((f) => (
                <li
                  key={`${f.ts}-${f.mode}`}
                  className="rounded-lg bg-slate-50 p-3 text-sm"
                >
                  <span className="font-medium">{MODE_LABEL[f.mode]}</span> ·{' '}
                  {f.rating}/5 · ship {f.wouldShip}
                  {f.comment ? (
                    <p className="mt-1 mb-0 text-slate-600">{f.comment}</p>
                  ) : null}
                </li>
              ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() =>
            download(
              'voice-demo-feedback.json',
              JSON.stringify(feedback, null, 2),
              'application/json',
            )
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          Export feedback JSON
        </button>
        <button
          type="button"
          onClick={() =>
            download('voice-demo-feedback.csv', feedbackToCsv(feedback), 'text/csv')
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          Export feedback CSV
        </button>
        <button
          type="button"
          onClick={() =>
            download(
              'voice-demo-attempts.json',
              JSON.stringify(attempts, null, 2),
              'application/json',
            )
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          Export attempts JSON
        </button>
        <button
          type="button"
          onClick={() =>
            download('voice-demo-attempts.csv', attemptsToCsv(attempts), 'text/csv')
          }
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          Export attempts CSV
        </button>
        {FEEDBACK_FORM_URL && (
          <a
            href={FEEDBACK_FORM_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-medium text-white no-underline"
          >
            Submit your pick
          </a>
        )}
        <button
          type="button"
          onClick={() => {
            if (
              confirm(
                'Clear feedback, attempts, and review events on this device?',
              )
            ) {
              clearLocalData()
              setTick((t) => t + 1)
            }
          }}
          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900"
        >
          Clear all local data
        </button>
      </div>
    </div>
  )
}
