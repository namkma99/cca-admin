import { reviewApi } from '@/modules/review/server/http';
import { ReviewService } from '@/modules/review/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const GET = (request: Request) =>
  reviewApi(request, (db, token) => new ReviewService(db).topics(token));
export const OPTIONS = (request: Request) =>
  reviewApi(request, async () => ({}));
