import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../helpers/database';
import { UserService } from '../../src/modules/users/server/service';
import { AuthService } from '../../src/modules/auth/server/service';
import { hashPassword } from '../../src/server/security/password';
import {
  users,
  authSessions,
  adminAuditLogs,
} from '../../src/server/db/schema';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let service: UserService;
let token: string;
const now = new Date('2026-11-12T12:00:00Z');

beforeAll(async () => {
  fixture = await createTestDatabase();
});
afterAll(async () => fixture?.client.close());
beforeEach(async () => {
  await fixture.client.exec('TRUNCATE users, rate_limits CASCADE');
  const verifier = await hashPassword('admin-password-123');
  const [admin] = await fixture.db
    .insert(users)
    .values({
      username: 'admin',
      passwordHash: verifier,
      role: 'admin',
      status: 'active',
      firstLoginAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  const auth = new AuthService(fixture.db, { now: () => now });
  token = (
    await auth.login(
      { username: 'admin', password: 'admin-password-123' },
      '127.0.0.1',
    )
  ).token;
  expect(admin).toBeTruthy();
  service = new UserService(fixture.db, { now: () => now });
});

describe('UserService', () => {
  it('rejects malformed input and duplicate usernames with safe application errors', async () => {
    await expect(
      service.create(token, { username: 'bad space' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', status: 400 });
    await service.create(token, { username: 'duplicate' });
    await expect(
      service.create(token, { username: 'duplicate' }),
    ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 });
    await expect(
      service.setStatus(token, 'not-an-id', { disabled: 'yes' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', status: 400 });
  });

  it('denies student and setup sessions while allowing only active admins', async () => {
    const pending = await service.create(token, { username: 'pending-user' });
    const auth = new AuthService(fixture.db, { now: () => now });
    const setup = await auth.login(
      { username: pending.user.username, password: pending.temporaryPassword },
      '127.0.0.1',
    );
    await expect(service.list(setup.token)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
    const activePassword = await hashPassword('student-password-123');
    await fixture.db.insert(users).values({
      username: 'student',
      passwordHash: activePassword,
      role: 'student',
      status: 'active',
      firstLoginAt: now,
      createdAt: now,
      updatedAt: now,
    });
    const student = await auth.login(
      { username: 'student', password: 'student-password-123' },
      '127.0.0.1',
    );
    await expect(service.list(student.token)).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('lists safe user fields and searches canonical usernames', async () => {
    await service.create(token, { username: 'Alice_1' });
    const result = await service.list(token, 'alice');
    expect(result.users).toHaveLength(1);
    expect(result.users[0]).toMatchObject({
      username: 'alice_1',
      role: 'student',
      status: 'pending_password',
    });
    expect(result.users[0]).not.toHaveProperty('passwordHash');
  });

  it('creates a pending student and returns a one-time temporary password', async () => {
    const result = await service.create(token, { username: 'New.Student' });
    expect(result.user).toMatchObject({
      username: 'new.student',
      role: 'student',
      status: 'pending_password',
    });
    expect(result.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const [stored] = await fixture.db
      .select()
      .from(users)
      .where(eq(users.username, 'new.student'));
    expect(stored?.passwordHash).not.toBe(result.temporaryPassword);
    expect(await fixture.db.select().from(adminAuditLogs)).toHaveLength(1);
  });

  it('disables a user, revokes all sessions, and writes an audit event', async () => {
    const created = await service.create(token, { username: 'locked' });
    const auth = new AuthService(fixture.db, { now: () => now });
    const setup = await auth.login(
      { username: 'locked', password: created.temporaryPassword },
      '127.0.0.1',
    );
    const result = await service.setStatus(token, created.user.id, {
      disabled: true,
    });
    expect(result.user.status).toBe('disabled');
    expect(await auth.getSession(setup.token)).toBeNull();
    expect(
      (await fixture.db.select().from(adminAuditLogs)).map((x) => x.action),
    ).toContain('disable_user');
    expect(
      await fixture.db
        .select()
        .from(authSessions)
        .where(eq(authSessions.userId, created.user.id)),
    ).toSatisfy((rows: Array<typeof authSessions.$inferSelect>) =>
      rows.every((row) => row.revokedAt),
    );
  });

  it('resets a password and keeps the user pending until setup', async () => {
    const created = await service.create(token, { username: 'reset.me' });
    const result = await service.resetPassword(token, created.user.id);
    expect(result.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(result.temporaryPassword).not.toBe(created.temporaryPassword);
    expect(result.user.status).toBe('pending_password');
  });

  it('restores pending status after reset, disable, and enable without activating repeatedly', async () => {
    const created = await service.create(token, { username: 'pending-cycle' });
    await service.resetPassword(token, created.user.id);
    await service.setStatus(token, created.user.id, { disabled: true });
    expect(
      (await service.setStatus(token, created.user.id, { disabled: false }))
        .user.status,
    ).toBe('pending_password');
    expect(
      (await service.setStatus(token, created.user.id, { disabled: false }))
        .user.status,
    ).toBe('pending_password');
  });

  it('rejects self disable and self reset', async () => {
    const [admin] = await fixture.db
      .select()
      .from(users)
      .where(eq(users.username, 'admin'));
    await expect(
      service.setStatus(token, admin!.id, { disabled: true }),
    ).rejects.toMatchObject({ code: 'SELF_ACTION' });
    await expect(service.resetPassword(token, admin!.id)).rejects.toMatchObject(
      { code: 'SELF_ACTION' },
    );
  });
});
