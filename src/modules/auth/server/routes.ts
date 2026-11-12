import 'server-only';
import { randomUUID } from 'node:crypto';
import { withDatabase } from '@/server/db/client';
import { readAuthConfig } from '@/server/security/auth-config';
import { AuthService } from './service';
import { createAuthHandlers } from './http';

export async function handleAuthRequest(
  operation: keyof ReturnType<typeof createAuthHandlers>,
  request: Request,
) {
  try {
    const handlers = createAuthHandlers({
      config: readAuthConfig(process.env),
      runWithService: (work) => withDatabase((db) => work(new AuthService(db))),
    });
    return await handlers[operation](request);
  } catch {
    const requestId = randomUUID();
    console.error(JSON.stringify({ event: 'auth_config_failure', requestId }));
    return Response.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Không thể xử lý yêu cầu. Vui lòng thử lại sau.',
        },
        requestId,
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
    );
  }
}
