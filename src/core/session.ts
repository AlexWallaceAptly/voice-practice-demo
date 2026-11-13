import { SIM_PASS_PERCENT, SIM_QUESTION_COUNT } from '../config'
import { matchAnswer } from './matcher'
import type {
  Attempt,
  Question,
  SessionPhase,
  Verdict,
} from './types'

export interface SessionQuestionResult {
  questionId: string
  transcript: string
  alternatives: string[]
  verdict: Verdict
  matchedDisplays: string[]
  overriddenToCorrect: boolean
  listenMs: number
  processMs: number
  engineId: string
  replayUsed: boolean
}

export interface SessionState {
  phase: SessionPhase
  questionIds: string[]
  index: number
  results: SessionQuestionResult[]
  currentTranscript: string
  currentAlternatives: string[]
  currentMatched: string[]
  currentVerdict: Verdict | null
  overriddenToCorrect: boolean
  listenMs: number
  processMs: number
  engineId: string
  replayUsed: boolean
  passedOverall: boolean | null
  scorePercent: number | null
}

export type SessionEvent =
  | { type: 'START'; questionIds: string[]; engineId: string }
  | { type: 'QUESTION_PLAY_ENDED' }
  | {
      type: 'LISTEN_RESULT'
      transcript: string
      alternatives?: string[]
      noSpeech: boolean
      listenMs: number
      processMs: number
    }
  | { type: 'OVERRIDE_CORRECT' }
  | { type: 'ADVANCE' }
  | { type: 'REQUEST_REPLAY' }
  | { type: 'RESET' }

export function createInitialSessionState(): SessionState {
  return {
    phase: 'IDLE',
    questionIds: [],
    index: 0,
    results: [],
    currentTranscript: '',
    currentAlternatives: [],
    currentMatched: [],
    currentVerdict: null,
    overriddenToCorrect: false,
    listenMs: 0,
    processMs: 0,
    engineId: '',
    replayUsed: false,
    passedOverall: null,
    scorePercent: null,
  }
}

export function selectSimQuestions(
  questions: Question[],
  includeDynamic: boolean,
  count = SIM_QUESTION_COUNT,
): Question[] {
  const eligible = questions.filter((q) => includeDynamic || !q.dynamic)
  const shuffled = [...eligible].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

function grade(
  question: Question,
  transcript: string,
  alternatives: string[],
  noSpeech: boolean,
): { verdict: Verdict; matchedDisplays: string[] } {
  if (noSpeech || transcript.trim().length === 0) {
    return { verdict: 'no-speech', matchedDisplays: [] }
  }
  const result = matchAnswer(question, transcript, { alternatives })
  if (result.noSpeech) {
    return { verdict: 'no-speech', matchedDisplays: [] }
  }
  return {
    verdict: result.passed ? 'pass' : 'fail',
    matchedDisplays: result.matchedDisplays,
  }
}

function summarize(results: SessionQuestionResult[]): {
  scorePercent: number
  passedOverall: boolean
} {
  const total = results.length
  if (total === 0) {
    return { scorePercent: 0, passedOverall: false }
  }
  const correct = results.filter(isCorrect).length
  const scorePercent = Math.round((correct / total) * 100)
  return {
    scorePercent,
    passedOverall: scorePercent >= SIM_PASS_PERCENT,
  }
}

function clearCurrent(): Partial<SessionState> {
  return {
    currentTranscript: '',
    currentAlternatives: [],
    currentMatched: [],
    currentVerdict: null,
    overriddenToCorrect: false,
    listenMs: 0,
    processMs: 0,
    replayUsed: false,
  }
}

/**
 * Pure session state machine for Mock Interview.
 * Pass `currentQuestion` when handling LISTEN_RESULT so grading can run.
 */
export function reduceSession(
  state: SessionState,
  event: SessionEvent,
  currentQuestion?: Question,
): SessionState {
  switch (event.type) {
    case 'RESET':
      return createInitialSessionState()

    case 'START':
      return {
        ...createInitialSessionState(),
        phase: 'PLAYING_QUESTION',
        questionIds: event.questionIds,
        engineId: event.engineId,
      }

    case 'QUESTION_PLAY_ENDED':
      if (state.phase !== 'PLAYING_QUESTION') return state
      return { ...state, phase: 'LISTENING' }

    case 'LISTEN_RESULT': {
      if (state.phase !== 'LISTENING') return state
      if (!currentQuestion) {
        return {
          ...state,
          phase: 'PROCESSING',
          currentTranscript: event.transcript,
          currentAlternatives: event.alternatives ?? [],
          listenMs: event.listenMs,
          processMs: event.processMs,
        }
      }

      const { verdict, matchedDisplays } = grade(
        currentQuestion,
        event.transcript,
        event.alternatives ?? [],
        event.noSpeech,
      )

      return {
        ...state,
        phase: 'RESULT',
        currentTranscript: event.transcript,
        currentAlternatives: event.alternatives ?? [],
        currentVerdict: verdict,
        currentMatched: matchedDisplays,
        overriddenToCorrect: false,
        listenMs: event.listenMs,
        processMs: event.processMs,
      }
    }

    case 'REQUEST_REPLAY': {
      if (state.phase !== 'RESULT' || state.currentVerdict !== 'no-speech') {
        return state
      }
      if (state.replayUsed) {
        return state
      }
      return {
        ...state,
        phase: 'PLAYING_QUESTION',
        replayUsed: true,
        currentTranscript: '',
        currentAlternatives: [],
        currentMatched: [],
        currentVerdict: null,
        overriddenToCorrect: false,
      }
    }

    case 'OVERRIDE_CORRECT': {
      if (state.phase !== 'RESULT') return state
      return {
        ...state,
        currentVerdict: 'pass',
        overriddenToCorrect: true,
      }
    }

    case 'ADVANCE': {
      if (state.phase !== 'RESULT') return state

      const entry: SessionQuestionResult = {
        questionId: state.questionIds[state.index] ?? '',
        transcript: state.currentTranscript,
        alternatives: state.currentAlternatives,
        verdict: state.currentVerdict ?? 'fail',
        matchedDisplays: state.currentMatched,
        overriddenToCorrect: state.overriddenToCorrect,
        listenMs: state.listenMs,
        processMs: state.processMs,
        engineId: state.engineId,
        replayUsed: state.replayUsed,
      }

      const results = [...state.results, entry]
      const nextIndex = state.index + 1

      if (nextIndex >= state.questionIds.length) {
        const { scorePercent, passedOverall } = summarize(results)
        return {
          ...state,
          ...clearCurrent(),
          phase: 'SUMMARY',
          results,
          index: nextIndex,
          scorePercent,
          passedOverall,
        }
      }

      return {
        ...state,
        ...clearCurrent(),
        phase: 'PLAYING_QUESTION',
        results,
        index: nextIndex,
      }
    }

    default:
      return state
  }
}

export function sessionResultsToAttempts(
  results: SessionQuestionResult[],
): Attempt[] {
  const ts = Date.now()
  return results.map((r) => ({
    ts,
    questionId: r.questionId,
    engineId: r.engineId,
    transcript: r.transcript,
    verdict: r.verdict,
    overriddenToCorrect: r.overriddenToCorrect,
    listenMs: r.listenMs,
    processMs: r.processMs,
  }))
}

export function isCorrect(result: SessionQuestionResult): boolean {
  return result.verdict === 'pass' || result.overriddenToCorrect
}
