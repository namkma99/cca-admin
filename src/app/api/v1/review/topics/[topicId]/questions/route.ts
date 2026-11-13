import { reviewApi } from '@/modules/review/server/http';
import { ReviewService } from '@/modules/review/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(
  request: Request,
  context: { params: Promise<{ topicId: string }> },
) {
  return reviewApi(request, async (db, token) =>
    new ReviewService(db).questions(token, (await context.params).topicId),
  );
}
export const OPTIONS = (request: Request) =>
  reviewApi(request, async () => ({}));
