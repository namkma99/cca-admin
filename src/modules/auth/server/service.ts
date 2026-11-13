import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { authSessions, rateLimits, users } from '@/server/db/schema';
import {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from '@/server/security/password';
import {
  createSessionToken,
  hashSessionToken,
  SESSION_TOKEN_PATTERN,
} from '@/server/security/session-token';
import type { AuthSession } from '../contracts/dto';
import { loginSchema, setupPasswordSchema } from '../contracts/schemas';
import { AuthError, forbidden, unauthenticated } from './errors';
import type { AuthDatabase } from './types';

export const AUTH_SESSION_MS = 24 * 60 * 60 * 1000;
export const SETUP_SESSION_MS = 10 * 60 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
type UserRow = typeof users.$inferSelect;
type SessionRow = typeof authSessions.$inferSelect;

function requireLoginRole(user: UserRow, requiredRole?: 'admin') {
  if (requiredRole && user.role !== requiredRole)
    throw new AuthError(
      'FORBIDDEN',
      403,
      'Trang quản trị chỉ dành cho tài khoản quản trị viên.',
    );
}

function toSession(user: UserRow, session: SessionRow): AuthSession {
  return {
    kind: session.kind,
    expiresAt: session.expiresAt.toISOString(),
    user: { id: user.id, username: user.username, role: user.role },
  };
}
function usable(user: UserRow, session: SessionRow, now: Date) {
  return (
    !session.revokedAt &&
    session.expiresAt > now &&
    ((session.kind === 'password_setup' &&
      user.status === 'pending_password') ||
      (session.kind === 'authenticated' && user.status === 'active'))
  );
}

export type LoginResult =
  | { token: string; session: AuthSession }
  | { needPassword: true; username: string };

export class AuthService {
  private readonly now: () => Date;
  constructor(
    private readonly db: AuthDatabase,
    options: { now?: () => Date } = {},
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private async consumeLimit(
    buckets: ReadonlyArray<readonly [string, number]>,
    windowMs: number,
  ) {
    const now = this.now();
    const expires = new Date(now.getTime() + windowMs);
    const allowed = await this.db.transaction(async (tx) => {
      let allowed = true;
      // Consistent order, including for attempts against nonexistent usernames.
      for (const [key, limit] of buckets) {
        const [row] = await tx
          .insert(rateLimits)
          .values({ key, windowStartedAt: now, count: 1, expiresAt: expires })
          .onConflictDoUpdate({
            target: rateLimits.key,
            set: {
              count: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
              windowStartedAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN ${now} ELSE ${rateLimits.windowStartedAt} END`,
              expiresAt: sql`CASE WHEN ${rateLimits.expiresAt} <= ${now} THEN ${expires} ELSE ${rateLimits.expiresAt} END`,
            },
          })
          .returning({ count: rateLimits.count });
        if (!row || row.count > limit) {
          allowed = false;
          break;
        }
      }
      return allowed;
    });
    // Throw after commit so denied/failed logins cannot roll back the counters.
    if (!allowed)
      throw new AuthError(
        'RATE_LIMITED',
        429,
        `Bạn đã thử quá nhiều lần. Vui lòng thử lại sau ${windowMs / 60000} phút.`,
        windowMs / 1000,
      );
  }

  async login(
    input: unknown,
    ip: string,
    requiredRole?: 'admin',
  ): Promise<LoginResult> {
    const parsed = loginSchema.safeParse(input);
    if (!parsed.success)
      throw new AuthError(
        'INVALID_INPUT',
        400,
        'Vui lòng kiểm tra username và mật khẩu.',
      );
    const { username, password } = parsed.data;
    await this.consumeLimit(
      [
        [`login:ip:${hashSessionToken(ip)}`, 50],
        [`login:user:${hashSessionToken(username)}`, 10],
      ],
      RATE_WINDOW_MS,
    );
    const [original] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const invalid = () =>
      new AuthError(
        'INVALID_CREDENTIALS',
        401,
        'Username hoặc mật khẩu không chính xác.',
      );

    if (!original || original.status === 'disabled') {
      await verifyPassword(password ?? 'dummy', DUMMY_PASSWORD_HASH);
      throw invalid();
    }
    requireLoginRole(original, requiredRole);

    // Pending accounts activate by username; no temporary password is issued.
    if (original.status === 'pending_password') {
      return this.db.transaction(async (tx) => {
        const [user] = await tx
          .select()
          .from(users)
          .where(eq(users.id, original.id))
          .for('update');
        if (!user || user.status !== 'pending_password') throw invalid();
        requireLoginRole(user, requiredRole);
        const now = this.now();
        const token = createSessionToken();
        const [session] = await tx
          .insert(authSessions)
          .values({
            userId: user.id,
            tokenHash: hashSessionToken(token),
            kind: 'password_setup',
            expiresAt: new Date(now.getTime() + SETUP_SESSION_MS),
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        if (!session) throw new Error('Session insert failed');
        await tx
          .update(users)
          .set({ lastLoginAt: now, updatedAt: now })
          .where(eq(users.id, user.id));
        return { token, session: toSession(user, session) };
      });
    }

    // User is active: if password is not provided yet, request password step
    if (!password) {
      return { needPassword: true, username: original.username };
    }

    const correct = await verifyPassword(
      password,
      original.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!correct) throw invalid();

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, original.id))
        .for('update');
      if (
        !user ||
        user.passwordHash !== original.passwordHash ||
        user.status !== 'active'
      )
        throw invalid();
      requireLoginRole(user, requiredRole);
      const now = this.now();
      const token = createSessionToken();
      const [session] = await tx
        .insert(authSessions)
        .values({
          userId: user.id,
          tokenHash: hashSessionToken(token),
          kind: 'authenticated',
          expiresAt: new Date(now.getTime() + AUTH_SESSION_MS),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!session) throw new Error('Session insert failed');
      await tx
        .update(users)
        .set({ lastLoginAt: now, updatedAt: now })
        .where(eq(users.id, user.id));
      return { token, session: toSession(user, session) };
    });
  }

  private async lookup(token: string | null) {
    if (!token || !SESSION_TOKEN_PATTERN.test(token)) return null;
    const [row] = await this.db
      .select({ user: users, session: authSessions })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(eq(authSessions.tokenHash, hashSessionToken(token)))
      .limit(1);
    return row ?? null;
  }

  async getSession(token: string | null): Promise<AuthSession | null> {
    const row = await this.lookup(token);
    return row && usable(row.user, row.session, this.now())
      ? toSession(row.user, row.session)
      : null;
  }

  async requireSession(
    token: string | null,
    role?: 'admin' | 'student',
  ): Promise<AuthSession> {
    const session = await this.getSession(token);
    if (!session) throw unauthenticated();
    if (
      session.kind !== 'authenticated' ||
      (role && session.user.role !== role)
    )
      throw forbidden();
    return session;
  }

  async setupPassword(
    token: string | null,
    input: unknown,
    requiredRole?: 'admin',
  ): Promise<{ token: string; session: AuthSession }> {
    const parsed = setupPasswordSchema.safeParse(input);
    if (!parsed.success)
      throw new AuthError(
        'INVALID_INPUT',
        400,
        'Mật khẩu cần 12–128 ký tự và xác nhận phải khớp.',
      );
    const original = await this.lookup(token);
    if (
      !original ||
      !usable(original.user, original.session, this.now()) ||
      original.session.kind !== 'password_setup'
    )
      throw unauthenticated();
    requireLoginRole(original.user, requiredRole);
    await this.consumeLimit(
      [[`setup:user:${hashSessionToken(original.user.id)}`, 5]],
      SETUP_SESSION_MS,
    );
    // Expensive derivation happens before locks; recheck the verifier and session under lock.
    const passwordHash = await hashPassword(parsed.data.password);
    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, original.user.id))
        .for('update');
      const [session] = await tx
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, original.session.id))
        .for('update');
      const now = this.now();
      if (
        !user ||
        !session ||
        !usable(user, session, now) ||
        session.kind !== 'password_setup' ||
        user.passwordHash !== original.user.passwordHash
      )
        throw unauthenticated();
      requireLoginRole(user, requiredRole);
      await tx
        .update(users)
        .set({
          passwordHash,
          status: 'active',
          firstLoginAt: user.firstLoginAt ?? now,
          lastLoginAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id));
      await tx
        .update(authSessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt)),
        );
      const nextToken = createSessionToken();
      const [next] = await tx
        .insert(authSessions)
        .values({
          userId: user.id,
          tokenHash: hashSessionToken(nextToken),
          kind: 'authenticated',
          expiresAt: new Date(now.getTime() + AUTH_SESSION_MS),
          createdAt: now,
          updatedAt: now,
        })
        .returning();
      if (!next) throw new Error('Session insert failed');
      return { token: nextToken, session: toSession(user, next) };
    });
  }

  async logout(token: string | null): Promise<void> {
    const original = await this.lookup(token);
    if (!original) return;
    await this.db.transaction(async (tx) => {
      await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, original.user.id))
        .for('update');
      const now = this.now();
      await tx
        .update(authSessions)
        .set({ revokedAt: now, updatedAt: now })
        .where(
          and(
            eq(authSessions.id, original.session.id),
            isNull(authSessions.revokedAt),
          ),
        );
    });
  }
}
