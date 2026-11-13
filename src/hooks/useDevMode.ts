import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

export function useDevMode(): boolean {
  const [params] = useSearchParams()
  return useMemo(() => params.get('dev') === '1', [params])
}
