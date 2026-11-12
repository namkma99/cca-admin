import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDatabase } from '../helpers/database';
import { AuthService } from '../../src/modules/auth/server/service';
import { createAdmin } from '../../src/modules/auth/server/provision-admin';
import { hashPassword } from '../../src/server/security/password';
import { hashSessionToken } from '../../src/server/security/session-token';
import { authSessions, users } from '../../src/server/db/schema';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let service: AuthService;
let now: Date;
let verifier: string;
const temporary = 'temporary-password-123';
const permanent = 'a-new-secure-password-123';

beforeAll(async () => {
  fixture = await createTestDatabase();
  verifier = await hashPassword(temporary);
}, 30000);
afterAll(async () => {
  await fixture?.client.close();
});
beforeEach(async () => {
  await fixture.client.exec('TRUNCATE users, rate_limits CASCADE');
  now = new Date('2026-11-12T12:00:00Z');
  service = new AuthService(fixture.db, { now: () => new Date(now) });
  await fixture.db.insert(users).values({
    username: 'student',
    passwordHash: verifier,
    createdAt: now,
    updatedAt: now,
  });
});
const login = async () => {
  const result = await service.login(
    { username: ' STUDENT ', password: temporary },
    '127.0.0.1',
  );
  if (!('token' in result)) throw new Error('Expected login session');
  return result;
};

describe('auth on PostgreSQL', () => {
  it('grants only a ten-minute setup session after proving the temporary password', async () => {
    const issued = await login();
    expect(issued.session.kind).toBe('password_setup');
    expect(issued.session.expiresAt).toBe('2026-11-12T12:10:00.000Z');
    const [stored] = await fixture.db.select().from(authSessions);
    expect(stored?.tokenHash).toBe(hashSessionToken(issued.token));
    expect(stored?.tokenHash).not.toBe(issued.token);
    expect(JSON.stringify(issued.session)).not.toContain('passwordHash');
    await expect(service.requireSession(issued.token)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('uses one generic error for unknown users, bad passwords and disabled users', async () => {
    await expect(
      service.login({ username: 'unknown', password: temporary }, '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      service.login({ username: 'student', password: 'wrong' }, '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await fixture.db.update(users).set({ status: 'disabled' });
    await expect(login()).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(await fixture.db.select().from(authSessions)).toHaveLength(0);
  });

  it('requires setup proof, matching passwords and a changed password', async () => {
    await expect(
      service.setupPassword(null, {
        password: permanent,
        confirmPassword: permanent,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const issued = await login();
    await expect(
      service.setupPassword(issued.token, {
        password: permanent,
        confirmPassword: 'different',
      }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(
      service.setupPassword(issued.token, {
        password: temporary,
        confirmPassword: temporary,
      }),
    ).rejects.toMatchObject({ code: 'PASSWORD_REUSE' });
  });

  it('activates once, revokes all setup sessions and rotates to a fixed 24-hour session', async () => {
    const first = await login();
    const other = await login();
    const active = await service.setupPassword(first.token, {
      password: permanent,
      confirmPassword: permanent,
    });
    expect(active.token).not.toBe(first.token);
    expect(active.session.kind).toBe('authenticated');
    expect(active.session.expiresAt).toBe('2026-11-13T12:00:00.000Z');
    expect(await service.getSession(first.token)).toBeNull();
    expect(await service.getSession(other.token)).toBeNull();
    await expect(
      service.setupPassword(other.token, {
        password: permanent,
        confirmPassword: permanent,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const [user] = await fixture.db.select().from(users);
    expect(user?.status).toBe('active');
    expect(user?.firstLoginAt?.toISOString()).toBe(now.toISOString());
    await expect(login()).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    const authLogin = await service.login(
      { username: 'student', password: permanent },
      '127.0.0.1',
    );
    expect('token' in authLogin && authLogin.session.kind).toBe(
      'authenticated',
    );
  });

  it('supports 2-step login: grants setup session for pending user with only username, and requires password for active user', async () => {
    await fixture.db.insert(users).values({
      username: 'new_student',
      passwordHash: null,
      role: 'student',
      status: 'pending_password',
      createdAt: now,
      updatedAt: now,
    });

    const setupResult = await service.login(
      { username: 'new_student' },
      '127.0.0.1',
    );
    expect('token' in setupResult).toBe(true);
    if ('token' in setupResult) {
      expect(setupResult.session.kind).toBe('password_setup');
      const active = await service.setupPassword(setupResult.token, {
        password: permanent,
        confirmPassword: permanent,
      });
      expect(active.session.kind).toBe('authenticated');
    }

    const step1Active = await service.login(
      { username: 'new_student' },
      '127.0.0.1',
    );
    expect(step1Active).toEqual({
      needPassword: true,
      username: 'new_student',
    });

    const step2Active = await service.login(
      { username: 'new_student', password: permanent },
      '127.0.0.1',
    );
    expect('token' in step2Active && step2Active.session.kind).toBe(
      'authenticated',
    );
  });

  it('checks database expiry at the exact boundary and does not refresh on reads', async () => {
    await fixture.db.update(users).set({ status: 'active' });
    const issued = await login();
    now = new Date('2026-11-13T11:59:59.999Z');
    expect((await service.getSession(issued.token))?.expiresAt).toBe(
      issued.session.expiresAt,
    );
    now = new Date('2026-11-13T12:00:00Z');
    expect(await service.getSession(issued.token)).toBeNull();
  });

  it('rejects expired setup sessions, malformed tokens and revoked sessions', async () => {
    const issued = await login();
    now = new Date('2026-11-12T12:10:00Z');
    await expect(
      service.setupPassword(issued.token, {
        password: permanent,
        confirmPassword: permanent,
      }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(await service.getSession('bad')).toBeNull();
    now = new Date('2026-11-12T12:01:00Z');
    await service.logout(issued.token);
    expect(await service.getSession(issued.token)).toBeNull();
    await service.logout(issued.token);
    await service.logout(null);
  });

  it('checks role and current account status on every request', async () => {
    await fixture.db.update(users).set({ status: 'active' });
    const issued = await login();
    await expect(
      service.requireSession(issued.token, 'admin'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await fixture.db.update(users).set({ role: 'admin' });
    expect(
      (await service.requireSession(issued.token, 'admin')).user.role,
    ).toBe('admin');
    await fixture.db.update(users).set({ status: 'disabled' });
    expect(await service.getSession(issued.token)).toBeNull();
  });

  it('persists rate limits across service instances and expires the window', async () => {
    for (let i = 0; i < 10; i++)
      await expect(
        service.login({ username: 'nobody', password: 'wrong' }, '127.0.0.1'),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const other = new AuthService(fixture.db, { now: () => now });
    await expect(
      other.login({ username: 'nobody', password: 'wrong' }, '127.0.0.2'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    now = new Date(now.getTime() + 15 * 60 * 1000);
    await expect(
      other.login({ username: 'nobody', password: 'wrong' }, '127.0.0.1'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('rejects the whole IP bucket before creating more username buckets', async () => {
    await fixture.client.query(
      `INSERT INTO rate_limits(key, window_started_at, count, expires_at) VALUES ($1, $2, 50, $3)`,
      [
        `login:ip:${hashSessionToken('127.0.0.1')}`,
        now.toISOString(),
        new Date(now.getTime() + 900000).toISOString(),
      ],
    );
    await expect(
      service.login(
        { username: 'random-name', password: 'wrong' },
        '127.0.0.1',
      ),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
    const result = await fixture.client.query(
      `SELECT * FROM rate_limits WHERE key LIKE 'login:user:%'`,
    );
    expect(result.rows).toHaveLength(0);
  });

  it('limits setup derivations per user across multiple setup sessions', async () => {
    const first = await login();
    const second = await login();
    for (let i = 0; i < 5; i++) {
      await expect(
        service.setupPassword(first.token, {
          password: temporary,
          confirmPassword: temporary,
        }),
      ).rejects.toMatchObject({ code: 'PASSWORD_REUSE' });
    }
    await expect(
      service.setupPassword(second.token, {
        password: permanent,
        confirmPassword: permanent,
      }),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 600 });
  });

  it('rolls back password/status/revocations when issuing the authenticated session fails', async () => {
    const issued = await login();
    await fixture.client
      .exec(`CREATE FUNCTION fail_auth_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind = 'authenticated' THEN RAISE EXCEPTION 'test failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER fail_auth BEFORE INSERT ON auth_sessions FOR EACH ROW EXECUTE FUNCTION fail_auth_insert();`);
    try {
      await expect(
        service.setupPassword(issued.token, {
          password: permanent,
          confirmPassword: permanent,
        }),
      ).rejects.toThrow();
      const [user] = await fixture.db.select().from(users);
      expect(user?.status).toBe('pending_password');
      expect(user?.passwordHash).toBe(verifier);
      expect((await service.getSession(issued.token))?.kind).toBe(
        'password_setup',
      );
    } finally {
      await fixture.client.exec(
        'DROP TRIGGER fail_auth ON auth_sessions; DROP FUNCTION fail_auth_insert();',
      );
    }
  });

  it('creates an admin with a one-time temporary password and refuses duplicates', async () => {
    const admin = await createAdmin(fixture.db, ' New.Admin ');
    expect(admin.username).toBe('new.admin');
    expect(admin.temporaryPassword).toMatch(/^[A-Za-z0-9_-]{32}$/);
    const [stored] = await fixture.db
      .select()
      .from(users)
      .where(eq(users.username, admin.username));
    expect(stored?.role).toBe('admin');
    expect(stored?.status).toBe('pending_password');
    expect(stored?.passwordHash).not.toBe(admin.temporaryPassword);
    const issued = await service.login(
      { username: admin.username, password: admin.temporaryPassword },
      '127.0.0.1',
    );
    expect('token' in issued && issued.session.kind).toBe('password_setup');
    await expect(createAdmin(fixture.db, 'new.admin')).rejects.toThrow();
    expect(
      (await fixture.db.select().from(users)).filter(
        (u) => u.username === admin.username,
      ),
    ).toHaveLength(1);
  });
});
