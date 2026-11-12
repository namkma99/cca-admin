import { and, asc, inArray, lte, or } from 'drizzle-orm';
import { withDatabase } from '@/server/db/client';
import { authSessions, rateLimits } from '@/server/db/schema';
import { ExamService } from '@/modules/exams/server/service';
import { validCronSecret } from '@/server/security/cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (
    !validCronSecret(
      request.headers.get('authorization'),
      process.env.CRON_SECRET,
    )
  )
    return Response.json(
      {
        error: { code: 'UNAUTHENTICATED', message: 'Không có quyền truy cập.' },
      },
      { status: 401, headers },
    );
  try {
    const report = await withDatabase(async (db) => {
      const finalized = await new ExamService(db).cleanupExpired(50);
      const now = new Date();
      const sessions = await db
        .select({ id: authSessions.id })
        .from(authSessions)
        .where(
          or(
            lte(authSessions.expiresAt, now),
            lte(authSessions.revokedAt, now),
          ),
        )
        .orderBy(asc(authSessions.expiresAt))
        .limit(200);
      if (sessions.length)
        await db.delete(authSessions).where(
          inArray(
            authSessions.id,
            sessions.map((s) => s.id),
          ),
        );
      const buckets = await db
        .select({ key: rateLimits.key })
        .from(rateLimits)
        .where(lte(rateLimits.expiresAt, now))
        .orderBy(asc(rateLimits.expiresAt))
        .limit(200);
      if (buckets.length)
        await db.delete(rateLimits).where(
          and(
            inArray(
              rateLimits.key,
              buckets.map((b) => b.key),
            ),
            lte(rateLimits.expiresAt, now),
          ),
        );
      return {
        finalized,
        deletedSessions: sessions.length,
        deletedRateLimits: buckets.length,
      };
    });
    return Response.json(report, { headers });
  } catch {
    console.error(JSON.stringify({ event: 'cleanup_failure' }));
    return Response.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Không thể hoàn tất dọn dữ liệu.',
        },
      },
      { status: 500, headers },
    );
  }
}
