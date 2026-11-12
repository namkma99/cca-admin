import Link from 'next/link';
import { requirePageSession } from '@/modules/auth/server/page-session';

export default async function AdminPage() {
  await requirePageSession('admin');
  return (
    <>
      <h1 className="text-3xl font-semibold">Quản trị CCA</h1>
      <p className="mt-4 text-muted-foreground">
        Bạn đã đăng nhập bằng tài khoản quản trị.
      </p>
      <Link
        className="mt-8 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
        href="/admin/users"
      >
        Quản lý người dùng
      </Link>
    </>
  );
}
