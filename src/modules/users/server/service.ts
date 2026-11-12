import 'server-only';
import { and, desc, eq, ilike, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { adminAuditLogs, authSessions, users } from '@/server/db/schema';
import {
  hashSessionToken,
  SESSION_TOKEN_PATTERN,
} from '@/server/security/session-token';
import { usernameSchema } from '@/modules/auth/contracts/schemas';
import { AppError } from '@/server/http/errors';
import type { AuthDatabase } from '@/modules/auth/server/types';
import { finalizeActiveForUser } from '@/modules/exams/server/service';

type UserRow = typeof users.$inferSelect;
type SafeUser = Pick<UserRow, 'id' | 'username' | 'role' | 'status'> & {
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};
type AuditRow = {
  id: string;
  action:
    | 'create_user'
    | 'disable_user'
    | 'enable_user'
    | 'reset_password'
    | 'reset_exam_cycle';
  metadata: Record<string, unknown>;
  createdAt: string;
  actorUserId: string;
  targetUserId: string;
};

const fail = (code: string, status: number, message: string) =>
  new AppError(code, status, message);
const safeUser = (row: UserRow): SafeUser => ({
  id: row.id,
  username: row.username,
  role: row.role,
  status: row.status,
  firstLoginAt: row.firstLoginAt?.toISOString() ?? null,
  lastLoginAt: row.lastLoginAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
});
const safeAudit = (row: typeof adminAuditLogs.$inferSelect): AuditRow => ({
  id: row.id,
  action: row.action,
  metadata: row.metadata,
  createdAt: row.createdAt.toISOString(),
  actorUserId: row.actorUserId,
  targetUserId: row.targetUserId,
});

export class UserService {
  private readonly now: () => Date;
  constructor(
    private readonly db: AuthDatabase,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private async serializeAdminMutation(tx: AuthDatabase) {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('cca-admin-user-mutation'))`,
    );
  }

  private async actor(tx: AuthDatabase, token: string | null) {
    if (!token || !SESSION_TOKEN_PATTERN.test(token))
      throw fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    const tokenHash = hashSessionToken(token);
    const [session] = await tx
      .select({ session: authSessions, user: users })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(eq(authSessions.tokenHash, tokenHash))
      .limit(1);
    if (!session)
      throw fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    if (session.session.revokedAt || session.session.expiresAt <= this.now())
      throw fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    const [locked] = await tx
      .select()
      .from(users)
      .where(eq(users.id, session.user.id))
      .for('update');
    const [freshSession] = await tx
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, session.session.id))
      .limit(1);
    if (
      !locked ||
      !freshSession ||
      freshSession.revokedAt ||
      freshSession.expiresAt <= this.now()
    )
      throw fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    if (freshSession.kind !== 'authenticated' || locked.role !== 'admin')
      throw fail(
        'FORBIDDEN',
        403,
        'Bạn không có quyền thực hiện thao tác này.',
      );
    if (locked.status !== 'active')
      throw fail(
        'UNAUTHENTICATED',
        401,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    return locked;
  }

  async list(token: string | null, query = ''): Promise<{ users: SafeUser[] }> {
    return this.db.transaction(async (tx) => {
      await this.actor(tx, token);
      const text = query.trim().toLowerCase();
      const rows = await tx
        .select()
        .from(users)
        .where(
          text
            ? ilike(users.username, `%${text.replace(/[%_]/g, '\\$&')}%`)
            : undefined,
        )
        .orderBy(users.username);
      return { users: rows.map(safeUser) };
    });
  }

  async get(token: string | null, id: string) {
    return this.db.transaction(async (tx) => {
      await this.actor(tx, token);
      const [user] = await tx.select().from(users).where(eq(users.id, id));
      if (!user) throw fail('NOT_FOUND', 404, 'Không tìm thấy tài khoản.');
      const logs = await tx
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.targetUserId, id))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(50);
      return { user: safeUser(user), recentAudit: logs.map(safeAudit) };
    });
  }

  async create(token: string | null, input: unknown) {
    const parsed = z
      .object({ username: usernameSchema })
      .strict()
      .safeParse(input);
    if (!parsed.success)
      throw fail('INVALID_INPUT', 400, 'Username không hợp lệ.');
    const username = parsed.data.username;
    return this.db.transaction(async (tx) => {
      await this.serializeAdminMutation(tx);
      const actor = await this.actor(tx, token);
      try {
        const [user] = await tx
          .insert(users)
          .values({
            username,
            passwordHash: null,
            role: 'student',
            status: 'pending_password',
          })
          .returning();
        if (!user) throw new Error('User insert failed');
        await tx.insert(adminAuditLogs).values({
          actorUserId: actor.id,
          targetUserId: user.id,
          action: 'create_user',
          metadata: { username },
        });
        return { user: safeUser(user) };
      } catch (error) {
        let cause: unknown = error;
        while (cause && typeof cause === 'object' && 'cause' in cause)
          cause = (cause as { cause?: unknown }).cause;
        if (
          (cause as { code?: string } | null)?.code === '23505' ||
          String(error).includes('users_username_')
        )
          throw fail('CONFLICT', 409, 'Username đã tồn tại.');
        throw error;
      }
    });
  }

  async setStatus(token: string | null, id: string, input: unknown) {
    const parsed = z
      .object({ disabled: z.boolean() })
      .strict()
      .safeParse(input);
    if (!parsed.success)
      throw fail('INVALID_INPUT', 400, 'disabled phải là boolean.');
    return this.db.transaction(async (tx) => {
      await this.serializeAdminMutation(tx);
      const actor = await this.actor(tx, token);
      const [target] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id))
        .for('update');
      if (!target) throw fail('NOT_FOUND', 404, 'Không tìm thấy tài khoản.');
      if (target.id === actor.id)
        throw fail(
          'SELF_ACTION',
          400,
          'Không thể thay đổi trạng thái tài khoản hiện tại.',
        );
      if (parsed.data.disabled) {
        if (target.status === 'disabled') return { user: safeUser(target) };
        if (target.role === 'admin' && target.status === 'active') {
          const [adminCount] = await tx
            .select({ count: sql<number>`count(*)` })
            .from(users)
            .where(and(eq(users.role, 'admin'), eq(users.status, 'active')));
          if (Number(adminCount?.count ?? 0) <= 1)
            throw fail(
              'LAST_ADMIN',
              409,
              'Không thể khóa quản trị viên cuối cùng.',
            );
        }
        const now = this.now();
        await finalizeActiveForUser(tx, id, now);
        await tx
          .update(users)
          .set({ status: 'disabled', updatedAt: now })
          .where(eq(users.id, id));
        await tx
          .update(authSessions)
          .set({ revokedAt: this.now(), updatedAt: this.now() })
          .where(
            and(eq(authSessions.userId, id), isNull(authSessions.revokedAt)),
          );
      } else {
        if (target.status !== 'disabled') return { user: safeUser(target) };
        const [previous] = await tx
          .select()
          .from(adminAuditLogs)
          .where(
            and(
              eq(adminAuditLogs.targetUserId, id),
              eq(adminAuditLogs.action, 'disable_user'),
            ),
          )
          .orderBy(desc(adminAuditLogs.createdAt))
          .limit(1);
        const restored =
          previous?.metadata &&
          typeof previous.metadata.from === 'string' &&
          (previous.metadata.from === 'active' ||
            previous.metadata.from === 'pending_password')
            ? previous.metadata.from
            : target.firstLoginAt
              ? 'active'
              : 'pending_password';
        await tx
          .update(users)
          .set({ status: restored, updatedAt: this.now() })
          .where(eq(users.id, id));
      }
      const [updated] = await tx.select().from(users).where(eq(users.id, id));
      if (!updated) throw new Error('User update failed');
      await tx.insert(adminAuditLogs).values({
        actorUserId: actor.id,
        targetUserId: id,
        action: parsed.data.disabled ? 'disable_user' : 'enable_user',
        metadata: { from: target.status, to: updated.status },
      });
      return { user: safeUser(updated) };
    });
  }

  async resetPassword(token: string | null, id: string) {
    return this.db.transaction(async (tx) => {
      await this.serializeAdminMutation(tx);
      const actor = await this.actor(tx, token);
      const [target] = await tx
        .select()
        .from(users)
        .where(eq(users.id, id))
        .for('update');
      if (!target) throw fail('NOT_FOUND', 404, 'Không tìm thấy tài khoản.');
      if (target.id === actor.id)
        throw fail(
          'SELF_ACTION',
          400,
          'Không thể đặt lại mật khẩu tài khoản hiện tại.',
        );
      if (target.status === 'disabled')
        throw fail(
          'DISABLED',
          409,
          'Hãy mở khóa tài khoản trước khi đặt lại mật khẩu.',
        );
      const now = this.now();
      await finalizeActiveForUser(tx, id, now);
      await tx
        .update(users)
        .set({ passwordHash: null, status: 'pending_password', updatedAt: now })
        .where(eq(users.id, id));
      await tx
        .update(authSessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(eq(authSessions.userId, id), isNull(authSessions.revokedAt)),
        );
      const [updated] = await tx.select().from(users).where(eq(users.id, id));
      if (!updated) throw new Error('User update failed');
      await tx.insert(adminAuditLogs).values({
        actorUserId: actor.id,
        targetUserId: id,
        action: 'reset_password',
        metadata: { from: target.status, to: 'pending_password' },
      });
      return { user: safeUser(updated) };
    });
  }

  async audit(token: string | null, id: string) {
    return this.db.transaction(async (tx) => {
      await this.actor(tx, token);
      const [target] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id));
      if (!target) throw fail('NOT_FOUND', 404, 'Không tìm thấy tài khoản.');
      const logs = await tx
        .select()
        .from(adminAuditLogs)
        .where(eq(adminAuditLogs.targetUserId, id))
        .orderBy(desc(adminAuditLogs.createdAt))
        .limit(100);
      return { logs: logs.map(safeAudit) };
    });
  }
}
