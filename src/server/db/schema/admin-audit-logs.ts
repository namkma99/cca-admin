import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './users';

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorUserId: uuid('actor_user_id')
      .notNull()
      .references(() => users.id),
    targetUserId: uuid('target_user_id')
      .notNull()
      .references(() => users.id),
    action: text('action', {
      enum: ['create_user', 'disable_user', 'enable_user', 'reset_password'],
    }).notNull(),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index('admin_audit_actor_created_idx').on(t.actorUserId, t.createdAt),
    index('admin_audit_target_created_idx').on(t.targetUserId, t.createdAt),
    check(
      'admin_audit_action_valid',
      sql`${t.action} IN ('create_user', 'disable_user', 'enable_user', 'reset_password')`,
    ),
    check(
      'admin_audit_metadata_object',
      sql`jsonb_typeof(${t.metadata}) = 'object'`,
    ),
  ],
);
