import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createTestDatabase } from '../helpers/database';
import { AuthService } from '../../src/modules/auth/server/service';
import { createAuthHandlers } from '../../src/modules/auth/server/http';
import { readAuthConfig } from '../../src/server/security/auth-config';
import { hashPassword } from '../../src/server/security/password';
import { users } from '../../src/server/db/schema';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let handlers: ReturnType<typeof createAuthHandlers>;
let verifier: string;
const origin = 'https://admin.example.com';
const frontend = 'https://learn.example.com';
const password = 'temporary-secret-123';
const config = readAuthConfig({
  NODE_ENV: 'production',
  APP_ORIGIN: origin,
  CCA_ALLOWED_ORIGINS: frontend,
});
function request(
  path: string,
  body?: unknown,
  extra: Record<string, string> = {},
) {
  return new Request(`${origin}/api/v1/auth/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...extra,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function cookie(response: Response) {
  return response.headers.get('set-cookie')!.split(';')[0]!;
}
async function login() {
  return handlers.login(request('login', { username: 'admin', password }));
}
beforeAll(async () => {
  fixture = await createTestDatabase();
  verifier = await hashPassword(password);
}, 30000);
afterAll(async () => {
  await fixture?.client.close();
});
beforeEach(async () => {
  await fixture.client.exec('TRUNCATE users, rate_limits CASCADE');
  await fixture.db
    .insert(users)
    .values({ username: 'admin', passwordHash: verifier, role: 'admin' });
  handlers = createAuthHandlers({
    config,
    runWithService: async (work) => work(new AuthService(fixture.db)),
  });
});

describe('auth HTTP boundary', () => {
  it('sets host-only Secure HttpOnly setup cookie and returns no secret fields', async () => {
    const response = await login();
    expect(response.status).toBe(200);
    const header = response.headers.get('set-cookie')!;
    expect(header).toContain('__Host-cca_session=');
    expect(header).toContain('HttpOnly');
    expect(header).toContain('Secure');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=600');
    expect(header).not.toContain('Domain=');
    const body = await response.json();
    expect(body.session.kind).toBe('password_setup');
    expect(Object.keys(body)).toEqual(['session']);
    expect(JSON.stringify(body)).not.toMatch(
      /token|passwordHash|password_hash/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
  it('rotates cookie after setup and clears it on idempotent logout', async () => {
    const first = await login();
    const setup = await handlers.setupPassword(
      request(
        'setup-password',
        {
          password: 'permanent-secret-123',
          confirmPassword: 'permanent-secret-123',
        },
        { Cookie: cookie(first) },
      ),
    );
    expect(setup.status).toBe(200);
    expect(setup.headers.get('set-cookie')).toContain('Max-Age=86400');
    expect(cookie(setup)).not.toBe(cookie(first));
    const session = await handlers.session(
      request('session', undefined, { Cookie: cookie(setup) }),
    );
    expect((await session.json()).session.kind).toBe('authenticated');
    const logout = await handlers.logout(
      request('logout', {}, { Cookie: cookie(setup) }),
    );
    expect(logout.status).toBe(200);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    const after = await handlers.session(
      request('session', undefined, { Cookie: cookie(setup) }),
    );
    expect((await after.json()).session).toBeNull();
    expect((await handlers.logout(request('logout', {}))).status).toBe(200);
  });
  it('blocks untrusted/missing/null origins for mutations before accessing DB', async () => {
    for (const badOrigin of ['https://evil.example', 'null']) {
      const response = await handlers.login(
        request(
          'login',
          { username: 'admin', password },
          { Origin: badOrigin },
        ),
      );
      expect(response.status).toBe(403);
      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    }
    const req = request('login', { username: 'admin', password });
    req.headers.delete('origin');
    expect((await handlers.login(req)).status).toBe(403);
    expect(
      (await fixture.client.query('SELECT * FROM auth_sessions')).rows,
    ).toHaveLength(0);
  });
  it('allows exact frontend origin with credentials, preflight and Vary', async () => {
    const response = await handlers.options(
      new Request(`${origin}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: {
          Origin: frontend,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      }),
    );
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe(frontend);
    expect(response.headers.get('access-control-allow-credentials')).toBe(
      'true',
    );
    expect(response.headers.get('vary')).toContain('Origin');
    const rejected = await handlers.options(
      new Request(`${origin}/api/v1/auth/login`, {
        method: 'OPTIONS',
        headers: { Origin: 'https://evil.example' },
      }),
    );
    expect(rejected.status).toBe(403);
  });
  it('rejects malformed JSON, oversized body and non-JSON mutations', async () => {
    expect(
      (
        await handlers.login(
          new Request(`${origin}/api/v1/auth/login`, {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json' },
            body: '{',
          }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handlers.login(
          request('login', { username: 'admin', password: 'x'.repeat(9000) }),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await handlers.login(
          request('login', {}, { 'Content-Type': 'text/plain' }),
        )
      ).status,
    ).toBe(415);
  });
  it('handles invalid cookies anonymously and never caches errors or returns stack traces', async () => {
    const response = await handlers.session(
      request('session', undefined, { Cookie: '__Host-cca_session=%ZZ' }),
    );
    expect((await response.json()).session).toBeNull();
    const failure = await handlers.login(
      request('login', { username: 'admin', password: 'wrong' }),
    );
    expect(failure.status).toBe(401);
    expect(failure.headers.get('cache-control')).toBe('no-store');
    const body = await failure.json();
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
    expect(body.requestId).toBeTruthy();
    expect(JSON.stringify(body)).not.toMatch(/stack|SELECT|passwordHash/);
  });
  it('sanitizes infrastructure failures and logs no connection details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const broken = createAuthHandlers({
        config,
        runWithService: async () => {
          throw new Error('postgresql://secret:credential@example.invalid/db');
        },
      });
      const response = await broken.session(request('session'));
      expect(response.status).toBe(500);
      expect(response.headers.get('cache-control')).toBe('no-store');
      const body = await response.text();
      expect(body).toContain('INTERNAL_ERROR');
      expect(body).not.toMatch(/secret|credential|postgresql/);
      expect(JSON.stringify(log.mock.calls)).not.toMatch(
        /secret|credential|postgresql/,
      );
    } finally {
      log.mockRestore();
    }
  });
});
