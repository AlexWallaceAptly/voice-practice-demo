import type { Question } from '../core/types'
import { QuestionsSchema } from './schema'

export async function loadQuestions(
  url = '/content/questions.json',
): Promise<Question[]> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Failed to load questions: HTTP ${res.status}`)
  }
  const data: unknown = await res.json()
  const parsed = QuestionsSchema.safeParse(data)
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(`Invalid questions.json: ${details}`)
  }
  return parsed.data
}

export function categoriesOf(questions: Question[]): string[] {
  return [...new Set(questions.map((q) => q.category))].sort()
}

export function filterByCategory(
  questions: Question[],
  category: string | 'all',
): Question[] {
  if (category === 'all') return questions
  return questions.filter((q) => q.category === category)
}

export function shuffleQuestions(questions: Question[]): Question[] {
  const copy = [...questions]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy
}
