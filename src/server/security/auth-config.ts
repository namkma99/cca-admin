import 'server-only';
import { isIP } from 'node:net';

export type AuthConfig = {
  appOrigin: string;
  allowedOrigins: ReadonlySet<string>;
  secure: boolean;
  onVercel: boolean;
  cookieName: string;
};
export function readAuthConfig(
  env: Record<string, string | undefined>,
): AuthConfig {
  const secure = env.NODE_ENV === 'production';
  const appOrigin = env.APP_ORIGIN ?? (secure ? '' : 'http://localhost:3000');
  const configured = [
    appOrigin,
    ...(env.CCA_ALLOWED_ORIGINS?.split(',')
      .map((v) => v.trim())
      .filter(Boolean) ?? []),
  ];
  for (const origin of configured) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(
        'Configure APP_ORIGIN and CCA_ALLOWED_ORIGINS with exact origins.',
      );
    }
    if (
      url.origin !== origin ||
      url.username ||
      url.password ||
      (secure
        ? url.protocol !== 'https:'
        : !['http:', 'https:'].includes(url.protocol))
    ) {
      throw new Error(
        'Auth origins must be exact HTTPS origins in production, without paths or wildcards.',
      );
    }
  }
  return {
    appOrigin,
    allowedOrigins: new Set(configured),
    secure,
    onVercel: env.VERCEL === '1',
    cookieName: secure ? '__Host-cca_session' : 'cca_session',
  };
}

export function clientIp(request: Request, onVercel: boolean): string {
  if (!onVercel) return 'local';
  const ip = request.headers
    .get('x-vercel-forwarded-for')
    ?.split(',')[0]
    ?.trim();
  return ip && isIP(ip) ? ip : 'unknown';
}
