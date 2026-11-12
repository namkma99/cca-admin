import { protectedApi } from '@/server/http/protected';
import { ExamService } from '@/modules/exams/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) =>
  protectedApi(request, (db, token) => new ExamService(db).catalog(token));
export const OPTIONS = (request: Request) =>
  protectedApi(request, async () => ({}));
