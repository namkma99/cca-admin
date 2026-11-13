import { cookies } from 'next/headers';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { UsersPanel } from '@/modules/users/components/users-panel';
import { UserService } from '@/modules/users/server/service';
import { withDatabase } from '@/server/db/client';

export default async function AdminUsersPage() {
  const session = await requirePageSession('admin');
  const cookieName =
    process.env.NODE_ENV === 'production'
      ? '__Host-cca_session'
      : 'cca_session';
  const token = (await cookies()).get(cookieName)?.value ?? null;
  const initialUsers = await withDatabase((db) =>
    new UserService(db).list(token, '').then((r) => r.users),
  );

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Người dùng</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Quản lý vai trò, trạng thái truy cập và lịch sử thi của từng tài
          khoản.
        </p>
      </div>
      <UsersPanel
        initialUsers={initialUsers}
        currentAdminId={session.user.id}
      />
    </section>
  );
}
