import { protectedApi } from '@/server/http/protected';
import { ExamService } from '@/modules/exams/server/service';
import { userIdInput } from '@/server/http/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  return protectedApi(
    request,
    async (db, token) => {
      const id = userIdInput((await context.params).userId);
      return new ExamService(db).history(token, id);
    },
    true,
  );
}
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}), true);
