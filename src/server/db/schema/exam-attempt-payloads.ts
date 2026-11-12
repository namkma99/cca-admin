import { sql } from 'drizzle-orm';
import { check, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { examAttempts } from './exam-attempts';
import type { QuestionSnapshot } from './questions';

export const examAttemptPayloads = pgTable(
  'exam_attempt_payloads',
  {
    attemptId: uuid('attempt_id')
      .primaryKey()
      .references(() => examAttempts.id, { onDelete: 'cascade' }),
    questionSnapshot: jsonb('question_snapshot')
      .$type<QuestionSnapshot[]>()
      .notNull(),
    answers: jsonb('answers')
      .$type<Record<string, string[]>>()
      .default({})
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check(
      'exam_payloads_snapshot_array',
      sql`jsonb_typeof(${t.questionSnapshot}) = 'array'`,
    ),
    check(
      'exam_payloads_answers_object',
      sql`jsonb_typeof(${t.answers}) = 'object'`,
    ),
  ],
);
