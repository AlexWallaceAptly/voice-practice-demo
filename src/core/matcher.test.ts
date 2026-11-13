import { describe, expect, it } from 'vitest'
import type { Question } from './types'
import { matchAnswer } from './matcher'

const bank: Record<string, Question> = {
  'supreme-law': {
    id: 'supreme-law',
    category: 'Government',
    prompt: 'What is the supreme law of the land?',
    questionAudio: 'audio/q/supreme-law.m4a',
    answerAudio: 'audio/a/supreme-law.m4a',
    answerMode: 'any',
    acceptedAnswers: [
      {
        display: 'the Constitution',
        variants: [
          'constitution',
          'the constitution',
          'us constitution',
          'united states constitution',
        ],
      },
    ],
  },
  capital: {
    id: 'capital',
    category: 'Geography',
    prompt: 'What is the capital of the United States?',
    questionAudio: 'audio/q/capital.m4a',
    answerAudio: 'audio/a/capital.m4a',
    answerMode: 'any',
    acceptedAnswers: [
      {
        display: 'Washington, D.C.',
        variants: ['washington dc', 'washington d c', 'washington', 'dc'],
      },
    ],
  },
  amendments: {
    id: 'amendments',
    category: 'Government',
    prompt: 'How many amendments does the Constitution have?',
    questionAudio: 'audio/q/amendments.m4a',
    answerAudio: 'audio/a/amendments.m4a',
    answerMode: 'any',
    acceptedAnswers: [
      {
        display: 'twenty-seven (27)',
        variants: ['27', 'twenty seven', 'twenty-seven'],
      },
    ],
  },
  'branches-two': {
    id: 'branches-two',
    category: 'Government',
    prompt: 'Name two branches of government.',
    questionAudio: 'audio/q/branches-two.m4a',
    answerAudio: 'audio/a/branches-two.m4a',
    answerMode: 'count',
    requiredCount: 2,
    acceptedAnswers: [
      {
        display: 'Congress (legislative)',
        variants: ['congress', 'legislative', 'legislature'],
      },
      {
        display: 'the President (executive)',
        variants: ['president', 'executive'],
      },
      {
        display: 'the courts (judicial)',
        variants: ['courts', 'judicial', 'supreme court', 'judiciary'],
      },
    ],
  },
}

function q(id: string): Question {
  const question = bank[id]
  if (!question) throw new Error(`missing question ${id}`)
  return question
}

describe('matchAnswer', () => {
  it('supreme-law: exact', () => {
    expect(matchAnswer(q('supreme-law'), 'the constitution').passed).toBe(true)
  })

  it('supreme-law: fillers and lead-in', () => {
    expect(
      matchAnswer(q('supreme-law'), "uh I think it's the US Constitution")
        .passed,
    ).toBe(true)
  })

  it('supreme-law: fuzzy constitutional', () => {
    expect(matchAnswer(q('supreme-law'), 'constitutional').passed).toBe(true)
  })

  it('supreme-law: wrong answer fails', () => {
    expect(
      matchAnswer(q('supreme-law'), 'the declaration of independence').passed,
    ).toBe(false)
  })

  it('capital: Washington DC', () => {
    expect(matchAnswer(q('capital'), 'Washington DC').passed).toBe(true)
  })

  it('capital: washington alone', () => {
    expect(matchAnswer(q('capital'), 'washington').passed).toBe(true)
  })

  it('capital: new york fails', () => {
    expect(matchAnswer(q('capital'), 'new york').passed).toBe(false)
  })

  it('amendments: twenty seven', () => {
    expect(matchAnswer(q('amendments'), 'twenty seven').passed).toBe(true)
  })

  it('amendments: 27', () => {
    expect(matchAnswer(q('amendments'), '27').passed).toBe(true)
  })

  it('amendments: twenty six fails', () => {
    expect(matchAnswer(q('amendments'), 'twenty six').passed).toBe(false)
  })

  it('branches-two: congress and the president', () => {
    expect(
      matchAnswer(q('branches-two'), 'congress and the president').passed,
    ).toBe(true)
  })

  it('branches-two: congress congress needs two distinct', () => {
    expect(matchAnswer(q('branches-two'), 'congress congress').passed).toBe(
      false,
    )
  })

  it('branches-two: legislative executive', () => {
    expect(
      matchAnswer(q('branches-two'), 'legislative executive').passed,
    ).toBe(true)
  })

  it('empty transcript is no speech', () => {
    const result = matchAnswer(q('supreme-law'), '')
    expect(result.passed).toBe(false)
    expect(result.noSpeech).toBe(true)
  })

  it('progress must not match congress', () => {
    const result = matchAnswer(q('branches-two'), 'progress')
    expect(result.matchedDisplays).not.toContain('Congress (legislative)')
    expect(result.passed).toBe(false)
  })
})
