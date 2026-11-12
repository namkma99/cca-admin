import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { withDatabase } from '@/server/db/client';
import { SESSION_TOKEN_PATTERN } from '@/server/security/session-token';
import { AuthService } from './service';

export const getPageSession = cache(async () => {
  const name =
    process.env.NODE_ENV === 'production'
      ? '__Host-cca_session'
      : 'cca_session';
  const values = (await cookies()).getAll(name);
  const token = values.length === 1 ? values[0]?.value : null;
  if (!token || !SESSION_TOKEN_PATTERN.test(token)) return null;
  return withDatabase((db) => new AuthService(db).getSession(token));
});

export async function requirePageSession(role?: 'admin' | 'student') {
  const session = await getPageSession();
  if (!session) redirect('/login');
  if (session.kind === 'password_setup') redirect('/setup-password');
  if (role && session.user.role !== role) redirect('/account');
  return session;
}
