import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createTestDatabase } from '../helpers/database';
import { users, authSessions } from '../../src/server/db/schema';
import {
  createSessionToken,
  hashSessionToken,
} from '../../src/server/security/session-token';
import { requirePageSession } from '../../src/modules/auth/server/page-session';

let fixture: Awaited<ReturnType<typeof createTestDatabase>>;
let cookieToken: string | null = null;
vi.mock('../../src/server/db/client', () => ({
  withDatabase: async (work: (db: typeof fixture.db) => Promise<unknown>) =>
    work(fixture.db),
}));
vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => (cookieToken ? [{ value: cookieToken }] : []),
  }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

beforeAll(async () => {
  fixture = await createTestDatabase();
});
afterAll(async () => {
  await fixture?.client.close();
});
beforeEach(async () => {
  cookieToken = null;
  await fixture.client.exec('TRUNCATE users CASCADE');
});

async function session(
  role: 'admin' | 'student',
  status: 'active' | 'pending_password' | 'disabled',
  kind: 'authenticated' | 'password_setup',
  invalid?: 'expired' | 'revoked',
) {
  const [account] = await fixture.db
    .insert(users)
    .values({ username: 'account', role, status })
    .returning();
  cookieToken = createSessionToken();
  await fixture.db.insert(authSessions).values({
    userId: account!.id,
    tokenHash: hashSessionToken(cookieToken),
    kind,
    createdAt: new Date(Date.now() - 86400000),
    expiresAt: new Date(
      Date.now() + (invalid === 'expired' ? -1000 : 86400000),
    ),
    revokedAt: invalid === 'revoked' ? new Date() : null,
  });
}

it('redirects anonymous visitors to login before rendering an admin page', async () => {
  await expect(requirePageSession('admin')).rejects.toThrow('REDIRECT:/login');
});
it('redirects authenticated students away from admin pages', async () => {
  await session('student', 'active', 'authenticated');
  await expect(requirePageSession('admin')).rejects.toThrow(
    'REDIRECT:/account',
  );
});
it('redirects pending admins to setup rather than granting manager access', async () => {
  await session('admin', 'pending_password', 'password_setup');
  await expect(requirePageSession('admin')).rejects.toThrow(
    'REDIRECT:/setup-password',
  );
});
it.each(['disabled', 'expired', 'revoked'] as const)(
  'redirects an admin with %s access to login',
  async (reason) => {
    await session(
      'admin',
      reason === 'disabled' ? 'disabled' : 'active',
      'authenticated',
      reason === 'disabled' ? undefined : reason,
    );
    await expect(requirePageSession('admin')).rejects.toThrow(
      'REDIRECT:/login',
    );
  },
);
it('only allows an active authenticated admin into manager pages', async () => {
  await session('admin', 'active', 'authenticated');
  expect((await requirePageSession('admin')).user.role).toBe('admin');
});
