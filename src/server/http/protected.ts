import 'server-only';
import { randomUUID } from 'node:crypto';
import { AuthService } from '@/modules/auth/server/service';
import { AuthError } from '@/modules/auth/server/errors';
import type { AuthDatabase } from '@/modules/auth/server/types';
import { withDatabase } from '@/server/db/client';
import { readAuthConfig, type AuthConfig } from '@/server/security/auth-config';
import { readSessionCookie } from '@/server/security/session-cookie';
import { AppError } from './errors';
import { readJson } from './json';

type Work = (
  db: AuthDatabase,
  token: string,
  input: unknown,
) => Promise<unknown>;
type Settings = {
  config: AuthConfig;
  runWithDatabase: <T>(work: (db: AuthDatabase) => Promise<T>) => Promise<T>;
};

export function createProtectedHandler({ config, runWithDatabase }: Settings) {
  return async function handle(
    request: Request,
    work: Work,
    admin = false,
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
        (request.method !== 'GET' && !allowed)
      )
        throw new AppError('ORIGIN_FORBIDDEN', 403, 'Origin không được phép.');
      if (request.method === 'OPTIONS') {
        const method = request.headers.get('access-control-request-method');
        const requested =
          request.headers
            .get('access-control-request-headers')
            ?.split(',')
            .map((h) => h.trim().toLowerCase()) ?? [];
        if (
          (method && !['GET', 'POST', 'PUT'].includes(method)) ||
          requested.some((h) => h !== 'content-type')
        )
          throw new AppError('FORBIDDEN', 403, 'Preflight không được phép.');
        headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        headers.set('Access-Control-Max-Age', '600');
        return new Response(null, { status: 204, headers });
      }
      const token = readSessionCookie(request, config);
      if (!token)
        throw new AuthError('UNAUTHENTICATED', 401, 'Vui lòng đăng nhập.');
      const input =
        request.method === 'GET' ? undefined : await readJson(request);
      const result = await runWithDatabase(async (db) => {
        await new AuthService(db).requireSession(
          token,
          admin ? 'admin' : undefined,
        );
        return work(db, token, input);
      });
      return Response.json(result, { headers });
    } catch (error) {
      const expected = error instanceof AppError || error instanceof AuthError;
      if (!expected)
        console.error(JSON.stringify({ event: 'api_failure', requestId }));
      return Response.json(
        {
          error: {
            code: expected ? error.code : 'INTERNAL_ERROR',
            message: expected
              ? error.message
              : 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
          },
          requestId,
        },
        { status: expected ? error.status : 500, headers },
      );
    }
  };
}

export async function protectedApi(
  request: Request,
  work: Work,
  admin = false,
) {
  try {
    return await createProtectedHandler({
      config: readAuthConfig(process.env),
      runWithDatabase: withDatabase,
    })(request, work, admin);
  } catch {
    const requestId = randomUUID();
    console.error(JSON.stringify({ event: 'api_config_failure', requestId }));
    return Response.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Không thể xử lý yêu cầu. Vui lòng thử lại.',
        },
        requestId,
      },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
