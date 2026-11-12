import { protectedApi } from '@/server/http/protected';
import { ExamService } from '@/modules/exams/server/service';
import { userIdInput, parseInput, topicSchema } from '@/server/http/input';
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
      await new ExamService(db).resetTopic(
        token,
        id,
        parseInput(z.object({ topicId: topicSchema }).strict(), input).topicId,
      );
      return { ok: true };
    },
    true,
  );
}
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}), true);
