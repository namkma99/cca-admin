import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { timestamps } from './common';
import { users } from './users';

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id, {
    onDelete: 'set null',
  }),
  ...timestamps(),
});
