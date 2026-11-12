import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './common';
import { users } from './users';

export const examCycles = pgTable(
  'exam_cycles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    topicCode: text('topic_code', {
      enum: ['cca-f', 'ccao-f', 'ccar-p'],
    }).notNull(),
    seed: text('seed').notNull(),
    bankVersion: text('bank_version').notNull(),
    generatorVersion: text('generator_version').notNull(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique('exam_cycles_id_user_unique').on(t.id, t.userId),
    uniqueIndex('exam_cycles_current_unique')
      .on(t.userId, t.topicCode)
      .where(sql`${t.closedAt} IS NULL`),
    check(
      'exam_cycles_topic_valid',
      sql`${t.topicCode} IN ('cca-f', 'ccao-f', 'ccar-p')`,
    ),
  ],
);
