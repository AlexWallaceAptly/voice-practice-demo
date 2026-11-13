import { doubleMetaphone } from 'double-metaphone'
import {
  MATCH_LENIENT_DEFAULT,
  MATCH_THRESHOLD,
  MATCH_THRESHOLD_LENIENT,
} from '../config'
import { normalizeForMatch, tokenize } from './normalize'
import type { AcceptedAnswer, MatchResult, Question } from './types'

export interface MatchOptions {
  lenient?: boolean
  alternatives?: string[]
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (curr[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + cost,
      )
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j] ?? 0
  }
  return prev[n] ?? 0
}

function similarity(a: string, b: string): number {
  if (a === b) return 1
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(a, b) / maxLen
}

function phoneticMatch(a: string, b: string): boolean {
  const [a1, a2] = doubleMetaphone(a)
  const [b1, b2] = doubleMetaphone(b)
  return (
    (a1.length > 0 && (a1 === b1 || a1 === b2)) ||
    (a2.length > 0 && (a2 === b1 || a2 === b2))
  )
}

function tokenMatches(
  variantToken: string,
  transcriptTokens: string[],
): boolean {
  for (const t of transcriptTokens) {
    if (variantToken.length < 5) {
      if (variantToken === t) return true
    } else if (similarity(variantToken, t) >= 0.8) {
      return true
    } else if (phoneticMatch(variantToken, t)) {
      return true
    }
  }
  return false
}

/** Score how well a single variant matches a normalized transcript. */
export function scoreVariant(
  transcriptNorm: string,
  variant: string,
): number {
  const variantNorm = normalizeForMatch(variant)
  if (!variantNorm) return 0
  if (!transcriptNorm) return 0

  // 1. Phrase containment
  if (
    transcriptNorm === variantNorm ||
    transcriptNorm.includes(variantNorm) ||
    variantNorm.includes(transcriptNorm)
  ) {
    // For short transcripts that are substrings of long variants, require
    // the transcript to cover a meaningful share of the variant.
    if (
      variantNorm.includes(transcriptNorm) &&
      transcriptNorm !== variantNorm
    ) {
      const vt = tokenize(variantNorm)
      const tt = tokenize(transcriptNorm)
      if (tt.length / Math.max(vt.length, 1) < 0.5 && tt.length < vt.length) {
        // fall through to fuzzy
      } else {
        return 1
      }
    } else {
      return 1
    }
  }

  const variantTokens = tokenize(variantNorm)
  const transcriptTokens = tokenize(transcriptNorm)
  if (variantTokens.length === 0) return 0

  let matched = 0
  for (const vt of variantTokens) {
    if (tokenMatches(vt, transcriptTokens)) matched += 1
  }

  const score = matched / variantTokens.length

  // For 1–2 token variants, require all tokens
  if (variantTokens.length <= 2 && matched < variantTokens.length) {
    return 0
  }

  return score
}

function bestScoreForAnswer(
  transcripts: string[],
  answer: AcceptedAnswer,
): number {
  let best = 0
  for (const transcript of transcripts) {
    const norm = normalizeForMatch(transcript)
    for (const variant of answer.variants) {
      best = Math.max(best, scoreVariant(norm, variant))
    }
  }
  return best
}

/**
 * Match a transcript (and optional engine alternatives) against accepted answers.
 * Pure logic — no browser imports.
 */
export function matchAnswer(
  question: Question,
  transcript: string,
  options: MatchOptions = {},
): MatchResult {
  const threshold =
    (options.lenient ?? MATCH_LENIENT_DEFAULT)
      ? MATCH_THRESHOLD_LENIENT
      : MATCH_THRESHOLD

  const transcripts = [
    transcript,
    ...(options.alternatives ?? []),
  ].filter((t) => t.trim().length > 0)

  if (transcripts.length === 0 || normalizeForMatch(transcript).length === 0) {
    // Empty primary transcript counts as no speech even if alternatives exist,
    // unless alternatives alone are provided as the only input.
    if (transcript.trim().length === 0 && !(options.alternatives?.length)) {
      return {
        passed: false,
        score: 0,
        matchedDisplays: [],
        noSpeech: true,
      }
    }
    if (transcripts.length === 0) {
      return {
        passed: false,
        score: 0,
        matchedDisplays: [],
        noSpeech: true,
      }
    }
  }

  const hits: { display: string; score: number }[] = []
  for (const answer of question.acceptedAnswers) {
    const score = bestScoreForAnswer(transcripts, answer)
    if (score >= threshold) {
      hits.push({ display: answer.display, score })
    }
  }

  hits.sort((a, b) => b.score - a.score)
  const matchedDisplays = hits.map((h) => h.display)
  const topScore = hits[0]?.score ?? 0

  let passed = false
  switch (question.answerMode) {
    case 'any':
      passed = matchedDisplays.length >= 1
      break
    case 'all':
      passed =
        matchedDisplays.length === question.acceptedAnswers.length &&
        question.acceptedAnswers.length > 0
      break
    case 'count': {
      const need = question.requiredCount ?? 1
      // Distinct accepted answers only
      const distinct = new Set(matchedDisplays)
      passed = distinct.size >= need
      break
    }
  }

  return {
    passed,
    score: topScore,
    matchedDisplays,
    noSpeech: false,
  }
}
