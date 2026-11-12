import { relations } from 'drizzle-orm';
import { users } from './users';
import { authSessions } from './auth-sessions';
import { examCycles } from './exam-cycles';
import { examAttempts } from './exam-attempts';
import { examAttemptPayloads } from './exam-attempt-payloads';
import { adminAuditLogs } from './admin-audit-logs';
import { settings } from './settings';

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(authSessions),
  cycles: many(examCycles),
  attempts: many(examAttempts),
  actions: many(adminAuditLogs, { relationName: 'auditActor' }),
  auditTargets: many(adminAuditLogs, { relationName: 'auditTarget' }),
}));
export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));
export const examCyclesRelations = relations(examCycles, ({ one, many }) => ({
  user: one(users, { fields: [examCycles.userId], references: [users.id] }),
  attempts: many(examAttempts),
}));
export const examAttemptsRelations = relations(examAttempts, ({ one }) => ({
  user: one(users, { fields: [examAttempts.userId], references: [users.id] }),
  cycle: one(examCycles, {
    fields: [examAttempts.cycleId, examAttempts.userId],
    references: [examCycles.id, examCycles.userId],
  }),
  payload: one(examAttemptPayloads),
}));
export const examAttemptPayloadsRelations = relations(
  examAttemptPayloads,
  ({ one }) => ({
    attempt: one(examAttempts, {
      fields: [examAttemptPayloads.attemptId],
      references: [examAttempts.id],
    }),
  }),
);
export const adminAuditLogsRelations = relations(adminAuditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [adminAuditLogs.actorUserId],
    references: [users.id],
    relationName: 'auditActor',
  }),
  target: one(users, {
    fields: [adminAuditLogs.targetUserId],
    references: [users.id],
    relationName: 'auditTarget',
  }),
}));
export const settingsRelations = relations(settings, ({ one }) => ({
  updatedByUser: one(users, {
    fields: [settings.updatedBy],
    references: [users.id],
  }),
}));
