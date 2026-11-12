import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createTestDatabase } from '../helpers/database';
import { createProtectedHandler } from '../../src/server/http/protected';
import { readAuthConfig } from '../../src/server/security/auth-config';
import { AuthService } from '../../src/modules/auth/server/service';
import { users } from '../../src/server/db/schema';
import { hashPassword } from '../../src/server/security/password';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let handler: ReturnType<typeof createProtectedHandler>;
let studentCookie: string;
let setupCookie: string;
const origin = 'http://localhost:3000';
beforeAll(async () => {
  fixture = await createTestDatabase();
}, 30000);
afterAll(async () => {
  await fixture?.client.close();
});
beforeEach(async () => {
  await fixture.client.exec('TRUNCATE users,rate_limits CASCADE');
  const password = 'synthetic-password-123';
  const hash = await hashPassword(password);
  await fixture.db.insert(users).values([
    { username: 'student', passwordHash: hash, status: 'active' },
    { username: 'pending', passwordHash: hash },
  ]);
  const auth = new AuthService(fixture.db);
  studentCookie = `cca_session=${(await auth.login({ username: 'student', password }, 'test')).token}`;
  setupCookie = `cca_session=${(await auth.login({ username: 'pending', password }, 'test')).token}`;
  handler = createProtectedHandler({
    config: readAuthConfig({ NODE_ENV: 'test', APP_ORIGIN: origin }),
    runWithDatabase: async (work) => work(fixture.db),
  });
});
it('requires authenticated session and admin role on protected APIs', async () => {
  const req = (cookie?: string) =>
    new Request(origin + '/api/v1/admin/users', {
      headers: cookie ? { Cookie: cookie } : {},
    });
  expect(
    (await handler(req(), async () => ({ secret: true }), true)).status,
  ).toBe(401);
  expect(
    (await handler(req(setupCookie), async () => ({ secret: true }), true))
      .status,
  ).toBe(403);
  expect(
    (await handler(req(studentCookie), async () => ({ secret: true }), true))
      .status,
  ).toBe(403);
  const own = await handler(req(studentCookie), async () => ({ ok: true }));
  expect(own.status).toBe(200);
  expect(own.headers.get('cache-control')).toBe('no-store');
});
it('rejects untrusted mutations and allows exact credential preflight without auth', async () => {
  const rejected = await handler(
    new Request(origin + '/x', {
      method: 'POST',
      headers: {
        Origin: 'https://evil.invalid',
        Cookie: studentCookie,
        'Content-Type': 'application/json',
      },
      body: '{}',
    }),
    async () => ({ ok: true }),
  );
  expect(rejected.status).toBe(403);
  const pre = await handler(
    new Request(origin + '/x', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'PUT',
        'Access-Control-Request-Headers': 'content-type',
      },
    }),
    async () => ({}),
  );
  expect(pre.status).toBe(204);
  expect(pre.headers.get('access-control-allow-credentials')).toBe('true');
});
