import 'server-only';
import type { AuthConfig } from './auth-config';
import { SESSION_TOKEN_PATTERN } from './session-token';

export function readSessionCookie(
  request: Request,
  config: AuthConfig,
): string | null {
  const matches = (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${config.cookieName}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(config.cookieName.length + 1);
  return SESSION_TOKEN_PATTERN.test(value) ? value : null;
}
export function sessionCookie(
  token: string,
  expiresAt: string,
  config: AuthConfig,
): string {
  const expires = new Date(expiresAt);
  const maxAge = Math.max(
    0,
    Math.ceil((expires.getTime() - Date.now()) / 1000),
  );
  return `${config.cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}; Expires=${expires.toUTCString()}${config.secure ? '; Secure' : ''}`;
}
export function clearSessionCookie(config: AuthConfig): string {
  return `${config.cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${config.secure ? '; Secure' : ''}`;
}
