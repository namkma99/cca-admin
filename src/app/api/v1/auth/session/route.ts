import { handleAuthRequest } from '@/modules/auth/server/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) => handleAuthRequest('session', request);
export const OPTIONS = (request: Request) =>
  handleAuthRequest('options', request);
