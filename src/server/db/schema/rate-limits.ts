import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    windowStartedAt: timestamp('window_started_at', {
      withTimezone: true,
    }).notNull(),
    count: integer('count').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    index('rate_limits_expiry_idx').on(t.expiresAt),
    check('rate_limits_count_nonnegative', sql`${t.count} >= 0`),
    check(
      'rate_limits_window_valid',
      sql`${t.expiresAt} > ${t.windowStartedAt}`,
    ),
  ],
);
