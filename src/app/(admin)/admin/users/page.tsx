import { cookies } from 'next/headers';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { UsersPanel } from '@/modules/users/components/users-panel';
import { UserService } from '@/modules/users/server/service';
import { withDatabase } from '@/server/db/client';

export default async function AdminUsersPage() {
  await requirePageSession('admin');
  const cookieName =
    process.env.NODE_ENV === 'production'
      ? '__Host-cca_session'
      : 'cca_session';
  const token = (await cookies()).get(cookieName)?.value ?? null;
  const initialUsers = await withDatabase((db) =>
    new UserService(db)
      .list(token, '')
      .then((r) => r.users)
      .catch(() => []),
  );

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Người dùng</h1>
        <p className="mt-2 text-muted-foreground">
          Tạo tài khoản học viên, quản lý danh sách và khóa/mở khóa tài khoản.
        </p>
      </div>
      <UsersPanel initialUsers={initialUsers} />
    </section>
  );
}
