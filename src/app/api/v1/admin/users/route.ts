import { protectedApi } from '@/server/http/protected';
import { UserService } from '@/modules/users/server/service';
import { z } from 'zod';
import { parseInput } from '@/server/http/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) =>
  protectedApi(
    request,
    (db, token) =>
      new UserService(db).list(
        token,
        new URL(request.url).searchParams.get('q') ?? '',
      ),
    true,
  );
export const POST = (request: Request) =>
  protectedApi(
    request,
    (db, token, input) =>
      new UserService(db).create(
        token,
        parseInput(z.object({ username: z.string() }).strict(), input),
      ),
    true,
  );
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}), true);
