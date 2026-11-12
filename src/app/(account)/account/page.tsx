import Link from 'next/link';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { LogoutButton } from '@/modules/auth/components/logout-button';

export default async function AccountPage() {
  const session = await requirePageSession();
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-6 py-16">
      <h1 className="text-3xl font-semibold">
        Xin chào, {session.user.username}
      </h1>
      <p className="text-muted-foreground">Bạn đã đăng nhập thành công.</p>
      {session.user.role === 'admin' && (
        <Link href="/admin" className="text-primary underline">
          Mở trang quản trị
        </Link>
      )}
      <LogoutButton />
    </main>
  );
}
