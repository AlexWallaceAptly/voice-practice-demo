import { useEffect, useState } from 'react'
import { loadQuestions } from '../content/loadQuestions'
import type { Question } from '../core/types'

export function useQuestions(): {
  questions: Question[]
  loading: boolean
  error: string | null
} {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadQuestions()
      .then((q) => {
        if (!cancelled) {
          setQuestions(q)
          setLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { questions, loading, error }
}
