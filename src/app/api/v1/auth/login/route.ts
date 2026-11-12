import { handleAuthRequest } from '@/modules/auth/server/routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (request: Request) => handleAuthRequest('login', request);
export const OPTIONS = (request: Request) =>
  handleAuthRequest('options', request);
