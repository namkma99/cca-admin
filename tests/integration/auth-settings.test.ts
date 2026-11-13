import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { eq } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { createTestDatabase } from '../helpers/database';
import { SettingsService } from '../../src/modules/settings/server/service';
import { AuthService } from '../../src/modules/auth/server/service';
import { createAuthHandlers } from '../../src/modules/auth/server/http';
import { readAuthConfig } from '../../src/server/security/auth-config';
import { hashPassword } from '../../src/server/security/password';
import { settings, users } from '../../src/server/db/schema';
import { GET, PUT } from '../../src/app/api/v1/admin/settings/route';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let actorId: string;
let service: SettingsService;
let auth: AuthService;
let verifier: string;
let now: Date;
const password = 'settings-test-password-123';
const defaults = {
  sessionDurationMinutes: 1440,
  passwordSetupDurationMinutes: 10,
  loginRateLimit: {
    windowMinutes: 15,
    maxAttemptsPerUsername: 10,
    maxAttemptsPerIp: 50,
  },
};

vi.mock('../../src/server/db/client', () => ({
  withDatabase: async (work: (db: typeof fixture.db) => Promise<unknown>) =>
    work(fixture.db),
}));

beforeAll(async () => {
  fixture = await createTestDatabase();
  verifier = await hashPassword(password);
  vi.stubEnv('APP_ORIGIN', 'http://localhost:3001');
  vi.stubEnv('NODE_ENV', 'test');
});
afterAll(async () => {
  vi.unstubAllEnvs();
  await fixture?.client.close();
});
beforeEach(async () => {
  await fixture.client.exec('TRUNCATE users, settings, rate_limits CASCADE');
  now = new Date('2026-11-13T12:00:00Z');
  const [actor] = await fixture.db
    .insert(users)
    .values({
      username: 'admin',
      role: 'admin',
      status: 'active',
      passwordHash: verifier,
    })
    .returning();
  actorId = actor!.id;
  await fixture.db.insert(users).values([
    { username: 'reader', status: 'active', passwordHash: verifier },
    { username: 'pending', status: 'pending_password', passwordHash: null },
  ]);
  service = new SettingsService(fixture.db);
  auth = new AuthService(fixture.db, { now: () => now });
});

async function login(username = 'reader', ip = 'test-ip') {
  const result = await auth.login({ username, password }, ip);
  if (!('token' in result)) throw new Error('Expected session');
  return result;
}

describe('auth settings', () => {
  it('returns defaults without seed data and merges partial nested updates', async () => {
    expect((await service.getAll()).auth).toEqual(defaults);
    await service.update(actorId, {
      auth: {
        sessionDurationMinutes: 60,
        loginRateLimit: { maxAttemptsPerIp: 20 },
      },
    });
    const updated = await service.update(actorId, {
      auth: {
        passwordSetupDurationMinutes: 5,
        loginRateLimit: { maxAttemptsPerUsername: 3 },
      },
    });
    expect(updated.auth).toEqual({
      sessionDurationMinutes: 60,
      passwordSetupDurationMinutes: 5,
      loginRateLimit: {
        windowMinutes: 15,
        maxAttemptsPerUsername: 3,
        maxAttemptsPerIp: 20,
      },
    });
    expect((await service.update(actorId, { formCount: 8 })).auth).toEqual(
      updated.auth,
    );
    const [stored] = await fixture.db
      .select()
      .from(settings)
      .where(eq(settings.key, 'auth'));
    expect(stored?.updatedBy).toBe(actorId);
    expect(stored?.value).toEqual(updated.auth);
  });

  it.each([
    { sessionDurationMinutes: 0 },
    { sessionDurationMinutes: 43201 },
    { passwordSetupDurationMinutes: 61 },
    { sessionDurationMinutes: 1.5 },
    { loginRateLimit: { windowMinutes: 0 } },
    { loginRateLimit: { maxAttemptsPerUsername: 0 } },
    { loginRateLimit: { maxAttemptsPerIp: -1 } },
    { sessionDurationMinutes: '60' },
    { sessionDurationMinutes: null },
    { unexpected: true },
    { loginRateLimit: { unexpected: true } },
  ])(
    'rejects invalid auth policy %j without persisting other changes',
    async (policy) => {
      await expect(
        service.update(actorId, { systemName: 'Must not save', auth: policy }),
      ).rejects.toMatchObject({ code: 'INVALID_INPUT', status: 400 });
      expect((await service.getAll()).systemName).toBe('CCA Exam System');
    },
  );

  it('uses configured lifetimes for login and activation without changing existing sessions', async () => {
    const old = await login();
    await service.update(actorId, {
      auth: { sessionDurationMinutes: 30, passwordSetupDurationMinutes: 3 },
    });
    const active = await login();
    const pending = await login('pending');
    expect(old.session.expiresAt).toBe('2026-11-14T12:00:00.000Z');
    expect(active.session.expiresAt).toBe('2026-11-13T12:30:00.000Z');
    expect(pending.session.expiresAt).toBe('2026-11-13T12:03:00.000Z');
    const activated = await auth.setupPassword(pending.token, {
      password,
      confirmPassword: password,
    });
    expect(activated.session.expiresAt).toBe('2026-11-13T12:30:00.000Z');
    now = new Date('2026-11-13T12:30:00Z');
    expect(await auth.getSession(active.token)).toBeNull();
    expect((await auth.getSession(old.token))?.kind).toBe('authenticated');
  });

  it('enforces configured username limits across instances and expires the configured window', async () => {
    await service.update(actorId, {
      auth: {
        loginRateLimit: {
          windowMinutes: 2,
          maxAttemptsPerUsername: 2,
          maxAttemptsPerIp: 20,
        },
      },
    });
    for (let i = 0; i < 2; i++)
      await expect(
        auth.login({ username: 'missing', password }, `ip-${i}`),
      ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    const other = new AuthService(fixture.db, { now: () => now });
    await expect(
      other.login({ username: 'missing', password }, 'different-ip'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 120 });
    now = new Date('2026-11-13T12:02:00Z');
    await expect(
      other.login({ username: 'missing', password }, 'new-ip'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });

  it('enforces configured IP limits across different usernames', async () => {
    await service.update(actorId, {
      auth: { loginRateLimit: { maxAttemptsPerIp: 1 } },
    });
    await expect(
      auth.login({ username: 'missing1', password }, 'same-ip'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(
      auth.login({ username: 'missing2', password }, 'same-ip'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('reports the actual remaining wait when the policy changes during an active window', async () => {
    await service.update(actorId, {
      auth: { loginRateLimit: { windowMinutes: 5, maxAttemptsPerUsername: 1 } },
    });
    await expect(
      auth.login({ username: 'missing', password }, 'first'),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await service.update(actorId, {
      auth: { loginRateLimit: { windowMinutes: 1 } },
    });
    now = new Date('2026-11-13T12:01:00Z');
    await expect(
      auth.login({ username: 'missing', password }, 'second'),
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', retryAfterSeconds: 240 });
  });

  it('keeps policies admin-only through the real settings routes', async () => {
    // Routes use the wall clock, so issue their sessions with a real clock too.
    const liveAuth = new AuthService(fixture.db);
    const admin = await liveAuth.login(
      { username: 'admin', password },
      'admin-ip',
    );
    const reader = await liveAuth.login(
      { username: 'reader', password },
      'reader-ip',
    );
    if (!('token' in admin) || !('token' in reader))
      throw new Error('Expected session');
    const req = (token?: string, body?: unknown) =>
      new Request('http://localhost:3001/api/v1/admin/settings', {
        method: body ? 'PUT' : 'GET',
        headers: {
          Origin: 'http://localhost:3001',
          ...(token ? { Cookie: `cca_session=${token}` } : {}),
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req(reader.token))).status).toBe(403);
    expect(
      (await PUT(req(reader.token, { auth: { sessionDurationMinutes: 30 } })))
        .status,
    ).toBe(403);
    const saved = await PUT(
      req(admin.token, { auth: { sessionDurationMinutes: 30 } }),
    );
    expect(saved.status).toBe(200);
    expect((await saved.json()).settings.auth.sessionDurationMinutes).toBe(30);
    const read = await GET(req(admin.token));
    expect((await read.json()).settings.auth.sessionDurationMinutes).toBe(30);
    expect(
      (await PUT(req(admin.token, { auth: { sessionDurationMinutes: 0 } })))
        .status,
    ).toBe(400);
  });

  it('sets cookie lifetime and Retry-After from the configured policy', async () => {
    await service.update(actorId, {
      auth: {
        passwordSetupDurationMinutes: 4,
        loginRateLimit: { windowMinutes: 2, maxAttemptsPerIp: 1 },
      },
    });
    const handlers = createAuthHandlers({
      config: readAuthConfig({
        NODE_ENV: 'test',
        APP_ORIGIN: 'http://localhost:3001',
      }),
      runWithService: async (work) => work(new AuthService(fixture.db)),
    });
    const req = () =>
      new Request('http://localhost:3001/api/v1/auth/login', {
        method: 'POST',
        headers: {
          Origin: 'http://localhost:3001',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: 'pending' }),
      });
    const first = await handlers.login(req());
    expect(first.status).toBe(200);
    expect(first.headers.get('set-cookie')).toContain('Max-Age=240');
    const denied = await handlers.login(req());
    expect(denied.status).toBe(429);
    expect(Number(denied.headers.get('retry-after'))).toBeGreaterThanOrEqual(
      119,
    );
    expect(Number(denied.headers.get('retry-after'))).toBeLessThanOrEqual(120);
  });

  it('seeds defaults through the migration without overwriting an existing policy', async () => {
    const migration = await readFile(
      new URL('../../drizzle/0004_auth_settings.sql', import.meta.url),
      'utf8',
    );
    await fixture.client.exec(migration);
    expect(
      (
        await fixture.db.select().from(settings).where(eq(settings.key, 'auth'))
      )[0]?.value,
    ).toEqual(defaults);
    await service.update(actorId, { auth: { sessionDurationMinutes: 45 } });
    await fixture.client.exec(migration);
    expect((await service.getAll()).auth.sessionDurationMinutes).toBe(45);
  });
});
