import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { timestamps } from './common';
import { users } from './users';

export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull().unique(),
    kind: text('kind', { enum: ['password_setup', 'authenticated'] }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('auth_sessions_user_idx').on(t.userId),
    index('auth_sessions_expiry_idx').on(t.expiresAt),
    check(
      'auth_sessions_kind_valid',
      sql`${t.kind} IN ('password_setup', 'authenticated')`,
    ),
    check('auth_sessions_lifetime_valid', sql`${t.expiresAt} > ${t.createdAt}`),
  ],
);
