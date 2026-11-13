import { cookies } from 'next/headers';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { UserService } from '@/modules/users/server/service';
import { AuditLogsPanel } from '@/modules/users/components/audit-logs-panel';
import { withDatabase } from '@/server/db/client';

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePageSession('admin');
  const params = await searchParams;
  const query = typeof params.q === 'string' ? params.q.slice(0, 64) : '';
  const cookieName =
    process.env.NODE_ENV === 'production'
      ? '__Host-cca_session'
      : 'cca_session';
  const token = (await cookies()).get(cookieName)?.value ?? null;
  const initialData = await withDatabase((db) =>
    new UserService(db).listAudit(token, { query }),
  );
  return <AuditLogsPanel initialData={initialData} initialQuery={query} />;
}
