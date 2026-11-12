import { protectedApi } from '@/server/http/protected';
import { ExamService } from '@/modules/exams/server/service';
import { userIdInput } from '@/server/http/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  return protectedApi(request, async (db, token) => {
    const id = userIdInput((await context.params).attemptId);
    return new ExamService(db).finish(token, id, 'abandon');
  });
}
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}));
