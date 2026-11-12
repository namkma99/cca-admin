import type { AuthSession } from './dto';

export function authDestination(session: AuthSession): string {
  if (session.kind === 'password_setup') return '/setup-password';
  return session.user.role === 'admin' ? '/admin' : '/account';
}
