import 'server-only';
import { protectedApi } from '@/server/http/protected';

export async function reviewApi(
  request: Request,
  work: Parameters<typeof protectedApi>[1],
): Promise<Response> {
  const response = await protectedApi(request, work);
  // Apply to successes, preflight and errors (including configuration failures).
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
