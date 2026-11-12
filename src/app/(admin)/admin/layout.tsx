import type { ReactNode } from 'react';
import Link from 'next/link';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { LogoutButton } from '@/modules/auth/components/logout-button';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requirePageSession('admin');
  return (
    <div className="mx-auto max-w-5xl px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4">
        <div className="flex items-center gap-6">
          <Link
            href="/admin"
            className="font-semibold text-lg hover:text-primary"
          >
            CCA Admin
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/admin" className="hover:text-foreground">
              Tổng quan
            </Link>
            <Link href="/admin/users" className="hover:text-foreground">
              Người dùng
            </Link>
            <Link href="/admin/settings" className="hover:text-foreground">
              Cài đặt
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{session.user.username}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="py-10">{children}</main>
    </div>
  );
}
