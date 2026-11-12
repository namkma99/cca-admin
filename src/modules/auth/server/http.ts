import 'server-only';
import { randomUUID } from 'node:crypto';
import { clientIp, type AuthConfig } from '@/server/security/auth-config';
import {
  clearSessionCookie,
  readSessionCookie,
  sessionCookie,
} from '@/server/security/session-cookie';
import { AuthError } from './errors';
import { AppError } from '@/server/http/errors';
import { readJson } from '@/server/http/json';
import type { AuthService } from './service';

type Operation = 'login' | 'session' | 'setupPassword' | 'logout' | 'options';
type Options = {
  config: AuthConfig;
  runWithService: <T>(work: (service: AuthService) => Promise<T>) => Promise<T>;
};
export function createAuthHandlers({
  config,
  runWithService,
}: Options): Record<Operation, (request: Request) => Promise<Response>> {
  async function handle(
    operation: Operation,
    request: Request,
  ): Promise<Response> {
    const requestId = randomUUID();
    const origin = request.headers.get('origin');
    const allowed = origin !== null && config.allowedOrigins.has(origin);
    const headers = new Headers({
      'Cache-Control': 'no-store',
      Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
      'X-Request-Id': requestId,
    });
    if (allowed) {
      headers.set('Access-Control-Allow-Origin', origin);
      headers.set('Access-Control-Allow-Credentials', 'true');
    }
    try {
      if (
        (origin !== null && !allowed) ||
        (operation !== 'session' && !allowed)
      )
        throw new AuthError('ORIGIN_FORBIDDEN', 403, 'Origin không được phép.');
      if (operation === 'options') {
        const method = request.headers.get('access-control-request-method');
        const requestedHeaders =
          request.headers
            .get('access-control-request-headers')
            ?.split(',')
            .map((h) => h.trim().toLowerCase()) ?? [];
        if (
          (method && !['GET', 'POST'].includes(method)) ||
          requestedHeaders.some((h) => h !== 'content-type')
        )
          throw new AuthError('FORBIDDEN', 403, 'Preflight không được phép.');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        return new Response(null, { status: 204, headers });
      }
      const token = readSessionCookie(request, config);
      if (operation === 'session') {
        const session = await runWithService((service) =>
          service.getSession(token),
        );
        return Response.json({ session }, { headers });
      }
      const input = await readJson(request);
      if (operation === 'logout') {
        await runWithService((service) => service.logout(token));
        headers.set('Set-Cookie', clearSessionCookie(config));
        return Response.json({ ok: true }, { headers });
      }
      const issued = await runWithService((service) =>
        operation === 'login'
          ? service.login(input, clientIp(request, config.onVercel))
          : service.setupPassword(token, input),
      );
      headers.set(
        'Set-Cookie',
        sessionCookie(issued.token, issued.session.expiresAt, config),
      );
      return Response.json({ session: issued.session }, { headers });
    } catch (error) {
      const expected = error instanceof AuthError || error instanceof AppError;
      if (!expected)
        console.error(
          JSON.stringify({
            event: 'auth_failure',
            code: 'INTERNAL_ERROR',
            requestId,
          }),
        );
      if (expected && error.code === 'RATE_LIMITED')
        headers.set(
          'Retry-After',
          String(
            (error instanceof AuthError
              ? error.retryAfterSeconds
              : undefined) ?? 900,
          ),
        );
      return Response.json(
        {
          error: {
            code: expected ? error.code : 'INTERNAL_ERROR',
            message: expected
              ? error.message
              : 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.',
          },
          requestId,
        },
        { status: expected ? error.status : 500, headers },
      );
    }
  }
  return Object.fromEntries(
    ['login', 'session', 'setupPassword', 'logout', 'options'].map(
      (operation) => [
        operation,
        (request: Request) => handle(operation as Operation, request),
      ],
    ),
  ) as Record<Operation, (request: Request) => Promise<Response>>;
}
