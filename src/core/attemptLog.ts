import type { Attempt, FeedbackEntry, ReviewEvent } from './types'

/** Shape helpers for local attempt / feedback logs. No DOM imports. */

export function createAttempt(
  partial: Omit<Attempt, 'ts'> & { ts?: number },
): Attempt {
  return {
    ts: partial.ts ?? Date.now(),
    questionId: partial.questionId,
    engineId: partial.engineId,
    transcript: partial.transcript,
    verdict: partial.verdict,
    overriddenToCorrect: partial.overriddenToCorrect,
    listenMs: partial.listenMs,
    processMs: partial.processMs,
  }
}

export function createReviewEvent(
  questionId: string,
  result: ReviewEvent['result'],
  ts = Date.now(),
): ReviewEvent {
  return { questionId, result, ts }
}

export function createFeedbackEntry(
  partial: Omit<FeedbackEntry, 'ts'> & { ts?: number },
): FeedbackEntry {
  return {
    mode: partial.mode,
    rating: partial.rating,
    wouldShip: partial.wouldShip,
    comment: partial.comment,
    ts: partial.ts ?? Date.now(),
  }
}

export function attemptsToCsv(attempts: Attempt[]): string {
  const header = [
    'ts',
    'questionId',
    'engineId',
    'transcript',
    'verdict',
    'overriddenToCorrect',
    'listenMs',
    'processMs',
  ]
  const rows = attempts.map((a) =>
    [
      a.ts,
      csvEscape(a.questionId),
      csvEscape(a.engineId),
      csvEscape(a.transcript),
      a.verdict,
      a.overriddenToCorrect,
      a.listenMs,
      a.processMs,
    ].join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

export function feedbackToCsv(entries: FeedbackEntry[]): string {
  const header = ['ts', 'mode', 'rating', 'wouldShip', 'comment']
  const rows = entries.map((e) =>
    [
      e.ts,
      csvEscape(e.mode),
      e.rating,
      e.wouldShip,
      csvEscape(e.comment),
    ].join(','),
  )
  return [header.join(','), ...rows].join('\n')
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
