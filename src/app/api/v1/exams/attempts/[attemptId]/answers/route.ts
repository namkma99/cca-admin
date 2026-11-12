import { protectedApi } from '@/server/http/protected';
import { ExamService } from '@/modules/exams/server/service';
import { parseInput, answerInput, userIdInput } from '@/server/http/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function PUT(
  request: Request,
  context: { params: Promise<{ attemptId: string }> },
) {
  return protectedApi(request, async (db, token, input) => {
    const id = userIdInput((await context.params).attemptId);
    return new ExamService(db).save(token, id, parseInput(answerInput, input));
  });
}
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}));
