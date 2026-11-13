import { useState } from 'react'
import { createFeedbackEntry } from '../core/attemptLog'
import type { PracticeMode, WouldShip } from '../core/types'
import { saveFeedback } from '../lib/storage'

export function FeedbackPrompt({
  mode,
  onDone,
}: {
  mode: PracticeMode
  onDone?: () => void
}) {
  const [rating, setRating] = useState(0)
  const [wouldShip, setWouldShip] = useState<WouldShip | ''>('')
  const [comment, setComment] = useState('')
  const [saved, setSaved] = useState(false)

  const submit = () => {
    if (!rating || !wouldShip) return
    saveFeedback(
      createFeedbackEntry({
        mode,
        rating,
        wouldShip,
        comment: comment.trim(),
      }),
    )
    setSaved(true)
    onDone?.()
  }

  if (saved) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        Thanks — your feedback is stored on this device only.
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="m-0 text-base font-semibold">How useful was this?</h3>
      <p className="mt-1 text-sm text-slate-600">
        Stored locally so leadership can compare options. Nothing is uploaded.
      </p>
      <div className="mt-3 flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            className={`h-10 w-10 rounded-lg border text-sm font-semibold ${
              rating === n
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-slate-300 bg-white text-slate-800'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      <p className="mt-4 text-sm font-medium">Would you ship this?</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {(['yes', 'maybe', 'no'] as WouldShip[]).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setWouldShip(v)}
            className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
              wouldShip === v
                ? 'border-sky-600 bg-sky-600 text-white'
                : 'border-slate-300 bg-white'
            }`}
          >
            {v}
          </button>
        ))}
      </div>
      <label className="mt-4 block text-sm font-medium">
        Optional comment
        <textarea
          className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What worked? What felt off?"
        />
      </label>
      <button
        type="button"
        disabled={!rating || !wouldShip}
        onClick={submit}
        className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        Save feedback
      </button>
    </div>
  )
}
