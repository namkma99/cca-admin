import { protectedApi } from '@/server/http/protected';
import { UserService } from '@/modules/users/server/service';
import { userIdInput, parseInput } from '@/server/http/input';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return protectedApi(
    request,
    async (db, token, input) => {
      const id = userIdInput((await context.params).userId);
      return new UserService(db).setStatus(
        token,
        id,
        parseInput(z.object({ disabled: z.boolean() }).strict(), input),
      );
    },
    true,
  );
}
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}), true);
