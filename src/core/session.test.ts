import { describe, expect, it } from 'vitest'
import type { Question } from './types'
import {
  createInitialSessionState,
  isCorrect,
  reduceSession,
  selectSimQuestions,
  sessionResultsToAttempts,
} from './session'

function startAndAnswer(
  question: Question,
  transcript: string,
  noSpeech = false,
) {
  let state = reduceSession(createInitialSessionState(), {
    type: 'START',
    questionIds: [question.id],
    engineId: 'test-engine',
  })
  state = reduceSession(state, { type: 'QUESTION_PLAY_ENDED' })
  state = reduceSession(
    state,
    {
      type: 'LISTEN_RESULT',
      transcript,
      noSpeech,
      listenMs: 100,
      processMs: 50,
    },
    question,
  )
  return state
}

const sample: Question = {
  id: 'supreme-law',
  category: 'Government',
  prompt: 'What is the supreme law of the land?',
  questionAudio: 'audio/q/supreme-law.m4a',
  answerAudio: 'audio/a/supreme-law.m4a',
  answerMode: 'any',
  acceptedAnswers: [
    {
      display: 'the Constitution',
      variants: ['constitution', 'the constitution'],
    },
  ],
}

describe('session state machine', () => {
  it('flows from IDLE to RESULT on a correct answer', () => {
    const state = startAndAnswer(sample, 'the constitution')
    expect(state.phase).toBe('RESULT')
    expect(state.currentVerdict).toBe('pass')
  })

  it('marks no-speech and allows one replay', () => {
    let state = startAndAnswer(sample, '', true)
    expect(state.currentVerdict).toBe('no-speech')
    state = reduceSession(state, { type: 'REQUEST_REPLAY' })
    expect(state.phase).toBe('PLAYING_QUESTION')
    expect(state.replayUsed).toBe(true)
  })

  it('records override and advances to SUMMARY', () => {
    let state = startAndAnswer(sample, 'wrong answer')
    expect(state.currentVerdict).toBe('fail')
    state = reduceSession(state, { type: 'OVERRIDE_CORRECT' })
    expect(state.overriddenToCorrect).toBe(true)
    expect(state.currentVerdict).toBe('pass')
    state = reduceSession(state, { type: 'ADVANCE' })
    expect(state.phase).toBe('SUMMARY')
    expect(state.results[0]?.overriddenToCorrect).toBe(true)
    expect(isCorrect(state.results[0]!)).toBe(true)
  })

  it('selectSimQuestions excludes dynamic by default', () => {
    const questions: Question[] = [
      sample,
      { ...sample, id: 'president', dynamic: true },
    ]
    const selected = selectSimQuestions(questions, false, 10)
    expect(selected.map((q) => q.id)).toEqual(['supreme-law'])
  })

  it('sessionResultsToAttempts preserves verdicts', () => {
    let state = startAndAnswer(sample, 'the constitution')
    state = reduceSession(state, { type: 'ADVANCE' })
    const attempts = sessionResultsToAttempts(state.results)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]?.verdict).toBe('pass')
    expect(attempts[0]?.engineId).toBe('test-engine')
  })
})
