/** Demo placeholders — confirm real USCIS 2025 civics format before leadership review. */
export const SIM_QUESTION_COUNT = 10
export const SIM_PASS_PERCENT = 60

/** When false, questions marked dynamic are excluded from Mock Interview scoring. */
export const INCLUDE_DYNAMIC_IN_SIM = false

export const MATCH_THRESHOLD = 0.85
export const MATCH_THRESHOLD_LENIENT = 0.75
/** Lenient matching is on by default in the demo. */
export const MATCH_LENIENT_DEFAULT = true

export const DEFAULT_THINK_GAP_SEC = 4
export const MIN_THINK_GAP_SEC = 2
export const MAX_THINK_GAP_SEC = 8

export const LISTEN_MAX_MS = 15_000
export const LISTEN_NO_SPEECH_MS = 8_000
export const MANUAL_LISTEN_MAX_MS = 30_000

/** Whisper model id; switch to tiny.en if base is too slow. */
export const WHISPER_MODEL = 'onnx-community/whisper-base'

export const WHISPER_SILENCE_RMS = 0.01
export const WHISPER_END_SILENCE_MS = 1_200

export const STORAGE_KEYS = {
  feedback: 'voice-demo-feedback',
  attempts: 'voice-demo-attempts',
  reviewEvents: 'voice-demo-review-events',
  offlineReady: 'voice-demo-offline-ready',
  preferredEngine: 'voice-demo-preferred-engine',
  questionSet: 'voice-demo-question-set',
} as const

export const FEEDBACK_FORM_URL =
  (import.meta.env.VITE_FEEDBACK_FORM_URL as string | undefined) ?? ''

export const QUESTION_SETS = [
  {
    id: 'studio',
    label: 'Studio recordings',
    blurb: '7 questions read by our voice actor.',
    file: 'content/questions.json',
  },
  {
    id: 'voice-clone',
    label: 'AI voice clone',
    blurb: '10 national questions generated from a 90-second sample of the same voice.',
    file: 'content/questions-voice-clone.json',
  },
] as const

export type QuestionSetId = (typeof QUESTION_SETS)[number]['id']
