import { z } from 'zod'

export const AcceptedAnswerSchema = z.object({
  display: z.string().min(1),
  variants: z.array(z.string().min(1)).min(1),
})

export const QuestionSchema = z
  .object({
    id: z.string().min(1),
    category: z.string().min(1),
    prompt: z.string().min(1),
    questionAudio: z.string().min(1),
    answerAudio: z.string().min(1),
    answerMode: z.enum(['any', 'all', 'count']),
    requiredCount: z.number().int().positive().optional(),
    acceptedAnswers: z.array(AcceptedAnswerSchema).min(1),
    dynamic: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .superRefine((q, ctx) => {
    if (q.answerMode === 'count' && q.requiredCount == null) {
      ctx.addIssue({
        code: 'custom',
        message: `Question ${q.id}: answerMode "count" requires requiredCount`,
        path: ['requiredCount'],
      })
    }
  })

export const QuestionsSchema = z.array(QuestionSchema).min(1)
