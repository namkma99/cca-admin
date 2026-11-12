import { sql } from 'drizzle-orm';
import {
  check,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { timestamps } from './common';

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    username: varchar('username', { length: 64 }).notNull().unique(),
    passwordHash: text('password_hash'),
    role: text('role', { enum: ['admin', 'student'] })
      .default('student')
      .notNull(),
    status: text('status', { enum: ['pending_password', 'active', 'disabled'] })
      .default('pending_password')
      .notNull(),
    firstLoginAt: timestamp('first_login_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    check(
      'users_username_canonical',
      sql`${t.username} = lower(btrim(${t.username})) AND length(${t.username}) > 0`,
    ),
    check('users_role_valid', sql`${t.role} IN ('admin', 'student')`),
    check(
      'users_status_valid',
      sql`${t.status} IN ('pending_password', 'active', 'disabled')`,
    ),
  ],
);
