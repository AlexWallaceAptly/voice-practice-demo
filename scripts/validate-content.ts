#!/usr/bin/env tsx
/**
 * Fails if any referenced audio file is missing under public/.
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const questionsPath = join(root, 'public/content/questions.json')

interface QuestionRow {
  id: string
  questionAudio: string
  answerAudio: string
}

const raw = readFileSync(questionsPath, 'utf8')
const questions = JSON.parse(raw) as QuestionRow[]

let missing = 0
for (const q of questions) {
  for (const rel of [q.questionAudio, q.answerAudio]) {
    const full = join(root, 'public', rel)
    if (!existsSync(full)) {
      console.error(`MISSING: ${rel} (question ${q.id})`)
      missing += 1
    }
  }
}

if (missing > 0) {
  console.error(`\nvalidate-content failed: ${missing} file(s) missing.`)
  process.exit(1)
}

console.log(`validate-content OK: ${questions.length} questions, all audio present.`)
