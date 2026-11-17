import { useEffect, useState } from 'react'
import { QUESTION_SETS } from '../config'
import { loadQuestions } from '../content/loadQuestions'
import type { Question } from '../core/types'
import { assetUrl } from '../lib/assetUrl'
import { loadQuestionSet } from '../lib/storage'

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
    const set = QUESTION_SETS.find((s) => s.id === loadQuestionSet())
    void loadQuestions(set ? assetUrl(set.file) : undefined)
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
