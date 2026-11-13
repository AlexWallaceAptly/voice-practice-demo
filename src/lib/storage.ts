import { STORAGE_KEYS } from '../config'
import type { Attempt, FeedbackEntry, ReviewEvent } from '../core/types'

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadFeedback(): FeedbackEntry[] {
  return readJson(STORAGE_KEYS.feedback, [])
}

export function saveFeedback(entry: FeedbackEntry): void {
  const all = loadFeedback()
  all.push(entry)
  writeJson(STORAGE_KEYS.feedback, all)
}

export function loadAttempts(): Attempt[] {
  return readJson(STORAGE_KEYS.attempts, [])
}

export function appendAttempts(attempts: Attempt[]): void {
  const all = loadAttempts()
  all.push(...attempts)
  writeJson(STORAGE_KEYS.attempts, all)
}

export function loadReviewEvents(): ReviewEvent[] {
  return readJson(STORAGE_KEYS.reviewEvents, [])
}

export function appendReviewEvent(event: ReviewEvent): void {
  const all = loadReviewEvents()
  all.push(event)
  writeJson(STORAGE_KEYS.reviewEvents, all)
}

export function isOfflineReady(): boolean {
  return localStorage.getItem(STORAGE_KEYS.offlineReady) === '1'
}

export function setOfflineReady(ready: boolean): void {
  localStorage.setItem(STORAGE_KEYS.offlineReady, ready ? '1' : '0')
}

export function loadPreferredEngine(): string | null {
  return localStorage.getItem(STORAGE_KEYS.preferredEngine)
}

export function setPreferredEngine(id: string): void {
  localStorage.setItem(STORAGE_KEYS.preferredEngine, id)
}

/** Wipe feedback, attempts, and review events. Leaves audio/model caches. */
export function clearLocalData(): void {
  localStorage.removeItem(STORAGE_KEYS.feedback)
  localStorage.removeItem(STORAGE_KEYS.attempts)
  localStorage.removeItem(STORAGE_KEYS.reviewEvents)
}
