import { protectedApi } from '@/server/http/protected';
import { ExamService } from '@/modules/exams/server/service';
import { parseInput, startInput } from '@/server/http/input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const POST = (request: Request) =>
  protectedApi(request, (db, token, input) =>
    new ExamService(db).start(token, parseInput(startInput, input)),
  );
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}));
