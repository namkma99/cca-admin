import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './common';
import { users } from './users';
import { examCycles } from './exam-cycles';

export const examAttempts = pgTable(
  'exam_attempts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    cycleId: uuid('cycle_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    formNumber: smallint('form_number').notNull(),
    status: text('status', {
      enum: ['in_progress', 'submitted', 'abandoned', 'timed_out'],
    })
      .default('in_progress')
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    finalizedAt: timestamp('finalized_at', { withTimezone: true }),
    total: integer('total').notNull(),
    correct: integer('correct'),
    wrong: integer('wrong'),
    unanswered: integer('unanswered'),
    simulatedScore: integer('simulated_score'),
    ...timestamps(),
  },
  (t) => [
    foreignKey({
      name: 'exam_attempts_cycle_owner_fk',
      columns: [t.cycleId, t.userId],
      foreignColumns: [examCycles.id, examCycles.userId],
    }),
    unique('exam_attempts_cycle_form_unique').on(t.cycleId, t.formNumber),
    uniqueIndex('exam_attempts_active_user_unique')
      .on(t.userId)
      .where(sql`${t.status} = 'in_progress'`),
    index('exam_attempts_active_expiry_idx')
      .on(t.expiresAt)
      .where(sql`${t.status} = 'in_progress'`),
    index('exam_attempts_user_started_idx').on(t.userId, t.startedAt),
    check(
      'exam_attempts_status_valid',
      sql`${t.status} IN ('in_progress', 'submitted', 'abandoned', 'timed_out')`,
    ),
    check('exam_attempts_form_range', sql`${t.formNumber} BETWEEN 1 AND 10`),
    check('exam_attempts_total_positive', sql`${t.total} > 0`),
    check(
      'exam_attempts_deadline_exact',
      sql`${t.expiresAt} = ${t.startedAt} + interval '120 minutes'`,
    ),
    check(
      'exam_attempts_results_state',
      sql`(
    ${t.status} = 'in_progress'
    AND ${t.endedAt} IS NULL AND ${t.finalizedAt} IS NULL
    AND ${t.correct} IS NULL AND ${t.wrong} IS NULL AND ${t.unanswered} IS NULL AND ${t.simulatedScore} IS NULL
  ) OR (
    ${t.status} <> 'in_progress'
    AND ${t.endedAt} IS NOT NULL AND ${t.finalizedAt} IS NOT NULL
    AND ${t.correct} IS NOT NULL AND ${t.wrong} IS NOT NULL AND ${t.unanswered} IS NOT NULL AND ${t.simulatedScore} IS NOT NULL
    AND ${t.correct} >= 0 AND ${t.wrong} >= 0 AND ${t.unanswered} >= 0
    AND ${t.correct} + ${t.wrong} + ${t.unanswered} = ${t.total}
    AND ${t.simulatedScore} BETWEEN 100 AND 1000
    AND ${t.simulatedScore} = round(100 + 900.0 * ${t.correct} / ${t.total})
    AND ${t.endedAt} >= ${t.startedAt} AND ${t.endedAt} <= ${t.expiresAt}
    AND ${t.finalizedAt} >= ${t.endedAt}
    AND (${t.status} <> 'timed_out' OR ${t.endedAt} = ${t.expiresAt})
  )`,
    ),
  ],
);
