import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { withDatabase } from '@/server/db/client';
import { UserService } from '@/modules/users/server/service';
import { UserDetailPanel } from '@/modules/users/components/user-detail-panel';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await requirePageSession('admin');
  const { userId } = await params;
  const cookieName =
    process.env.NODE_ENV === 'production'
      ? '__Host-cca_session'
      : 'cca_session';
  const token = (await cookies()).get(cookieName)?.value ?? null;
  const detail = await withDatabase((db) =>
    new UserService(db).get(token, userId).catch(() => null),
  );
  if (!detail) notFound();
  return (
    <UserDetailPanel
      user={detail.user}
      audit={detail.recentAudit}
      currentAdminId={session.user.id}
    />
  );
}
