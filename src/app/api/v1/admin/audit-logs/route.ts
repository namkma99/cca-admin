import { protectedApi } from '@/server/http/protected';
import { UserService } from '@/modules/users/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) =>
  protectedApi(
    request,
    (db, token) => {
      const params = new URL(request.url).searchParams;
      return new UserService(db).listAudit(token, {
        query: params.get('q') ?? '',
        action: params.get('action') || undefined,
        page: params.get('page') ?? 1,
        pageSize: params.get('pageSize') ?? 25,
      });
    },
    true,
  );
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}), true);
