import {
  afterAll,
  beforeAll,
  beforeEach,
  afterEach,
  expect,
  it,
  vi,
} from 'vitest';
import { createTestDatabase } from '../helpers/database';
import {
  createSessionToken,
  hashSessionToken,
} from '../../src/server/security/session-token';
import {
  users,
  authSessions,
  adminAuditLogs,
  settings,
} from '../../src/server/db/schema';
import * as list from '../../src/app/api/v1/admin/users/route';
import * as detail from '../../src/app/api/v1/admin/users/[userId]/route';
import * as audit from '../../src/app/api/v1/admin/users/[userId]/audit/route';
import * as results from '../../src/app/api/v1/admin/users/[userId]/results/route';
import * as status from '../../src/app/api/v1/admin/users/[userId]/status/route';
import * as resetPassword from '../../src/app/api/v1/admin/users/[userId]/reset-password/route';
import * as resetCycle from '../../src/app/api/v1/admin/users/[userId]/reset-cycle/route';
import * as config from '../../src/app/api/v1/admin/settings/route';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
vi.mock('../../src/server/db/client', () => ({
  withDatabase: async (work: (db: typeof fixture.db) => Promise<unknown>) =>
    work(fixture.db),
}));
const origin = 'http://localhost:3001';
let targetId: string;
let adminId: string;
let tokens: Record<string, string>;
const routes = [
  { method: 'GET', path: 'users', handler: list.GET },
  {
    method: 'POST',
    path: 'users',
    handler: list.POST,
    body: { username: 'new-user' },
  },
  { method: 'GET', path: 'users/id', handler: detail.GET },
  { method: 'GET', path: 'users/id/audit', handler: audit.GET },
  { method: 'GET', path: 'users/id/results', handler: results.GET },
  {
    method: 'POST',
    path: 'users/id/status',
    handler: status.POST,
    body: { disabled: true },
  },
  {
    method: 'POST',
    path: 'users/id/reset-password',
    handler: resetPassword.POST,
    body: {},
  },
  {
    method: 'POST',
    path: 'users/id/reset-cycle',
    handler: resetCycle.POST,
    body: { topicId: 'cca-f' },
  },
  { method: 'GET', path: 'settings', handler: config.GET },
  {
    method: 'PUT',
    path: 'settings',
    handler: config.PUT,
    body: { systemName: 'Updated' },
  },
];
function request(method: string, path: string, token?: string, body?: unknown) {
  return new Request(`${origin}/api/v1/admin/${path.replace('id', targetId)}`, {
    method,
    headers: {
      Origin: origin,
      ...(token ? { Cookie: `cca_session=${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeAll(async () => {
  fixture = await createTestDatabase();
});
afterAll(async () => {
  await fixture?.client.close();
});
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(async () => {
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('APP_ORIGIN', origin);
  await fixture.client.exec('TRUNCATE users, settings, rate_limits CASCADE');
  tokens = {};
  for (const [name, role, state, kind] of [
    ['admin', 'admin', 'active', 'authenticated'],
    ['student', 'student', 'active', 'authenticated'],
    ['setup', 'admin', 'pending_password', 'password_setup'],
    ['disabled', 'admin', 'disabled', 'authenticated'],
    ['revoked', 'admin', 'active', 'authenticated'],
    ['expired', 'admin', 'active', 'authenticated'],
  ] as const) {
    const [user] = await fixture.db
      .insert(users)
      .values({ username: name, role, status: state })
      .returning();
    tokens[name] = createSessionToken();
    await fixture.db.insert(authSessions).values({
      userId: user!.id,
      tokenHash: hashSessionToken(tokens[name]!),
      kind,
      expiresAt: new Date(Date.now() + (name === 'expired' ? -1000 : 86400000)),
      revokedAt: name === 'revoked' ? new Date() : null,
      createdAt: new Date(Date.now() - 86400000),
    });
    if (name === 'admin') adminId = user!.id;
    if (name === 'student') targetId = user!.id;
  }
});

it('guards every real admin route against anonymous, student, setup, disabled, revoked and expired sessions', async () => {
  for (const [name, code] of [
    ['anonymous', 401],
    ['student', 403],
    ['setup', 403],
    // An unexpired, unrevoked session on a restricted account is forbidden.
    ['disabled', 403],
    ['revoked', 401],
    ['expired', 401],
  ] as const) {
    for (const route of routes) {
      const response = await route.handler(
        request(route.method, route.path, tokens[name], route.body),
        { params: Promise.resolve({ userId: targetId }) },
      );
      expect(response.status, `${name}: ${route.method} ${route.path}`).toBe(
        code,
      );
    }
  }
  expect(await fixture.db.select().from(adminAuditLogs)).toHaveLength(0);
  expect(await fixture.db.select().from(settings)).toHaveLength(0);
  expect(await fixture.db.select().from(users)).toHaveLength(6);
});

it('allows active admins to read protected resources and update settings', async () => {
  for (const route of routes.filter(
    (r) => r.method === 'GET' || r.path === 'settings',
  )) {
    const response = await route.handler(
      request(route.method, route.path, tokens.admin, route.body),
      { params: Promise.resolve({ userId: targetId }) },
    );
    expect(response.status, route.path).toBe(200);
  }
});

it('rejects role injection during account creation and blocks self lock/reset on the server', async () => {
  expect(
    (
      await list.POST(
        request('POST', 'users', tokens.admin, {
          username: 'injected',
          role: 'admin',
        }),
      )
    ).status,
  ).toBe(400);
  const context = { params: Promise.resolve({ userId: adminId }) };
  for (const [handler, path, body] of [
    [status.POST, 'status', { disabled: true }],
    [resetPassword.POST, 'reset-password', {}],
  ] as const) {
    const response = await handler(
      request('POST', `users/${adminId}/${path}`, tokens.admin, body),
      context,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('SELF_ACTION');
  }
});

it('blocks cycle resets for locked accounts on the server as well as the UI', async () => {
  const locked = await list.GET(request('GET', 'users', tokens.admin));
  const lockedId = (await locked.json()).users.find(
    (u: { username: string }) => u.username === 'disabled',
  ).id;
  const response = await resetCycle.POST(
    request('POST', `users/${lockedId}/reset-cycle`, tokens.admin, {
      topicId: 'cca-f',
    }),
    { params: Promise.resolve({ userId: lockedId }) },
  );
  expect(response.status).toBe(409);
  expect((await response.json()).error.code).toBe('DISABLED');
  expect(await fixture.db.select().from(adminAuditLogs)).toHaveLength(0);
});
