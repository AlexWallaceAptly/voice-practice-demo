export type AnswerMode = 'any' | 'all' | 'count'

export interface AcceptedAnswer {
  /** How it is shown to the learner, e.g. "Washington, D.C." */
  display: string
  /** Phrases that count as saying this answer */
  variants: string[]
}

export interface Question {
  /** Stable slug; also the audio filename stem */
  id: string
  category: string
  /** Text shown on screen (matches the recording) */
  prompt: string
  /** Path under /audio/q/ */
  questionAudio: string
  /** Path under /audio/a/ */
  answerAudio: string
  answerMode: AnswerMode
  /** For "Name two..." style questions */
  requiredCount?: number
  acceptedAnswers: AcceptedAnswer[]
  /** True if the answer depends on who currently holds an office */
  dynamic?: boolean
  notes?: string
}

export type Verdict = 'pass' | 'fail' | 'no-speech'

export interface Attempt {
  ts: number
  questionId: string
  engineId: string
  transcript: string
  verdict: Verdict
  overriddenToCorrect: boolean
  listenMs: number
  processMs: number
}

export type ReviewResult = 'got-it' | 'not-yet'

export interface ReviewEvent {
  questionId: string
  result: ReviewResult
  ts: number
}

export type PracticeMode = 'listen' | 'speak-self-check' | 'mock-interview'

export type WouldShip = 'yes' | 'maybe' | 'no'

export interface FeedbackEntry {
  mode: PracticeMode
  rating: number
  wouldShip: WouldShip
  comment: string
  ts: number
}

export type SessionPhase =
  | 'IDLE'
  | 'PLAYING_QUESTION'
  | 'LISTENING'
  | 'PROCESSING'
  | 'RESULT'
  | 'SUMMARY'

export interface MatchResult {
  passed: boolean
  score: number
  matchedDisplays: string[]
  noSpeech: boolean
}
