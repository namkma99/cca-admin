import type { ReactNode } from 'react';
import Link from 'next/link';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { LogoutButton } from '@/modules/auth/components/logout-button';
import { AdminNav } from '@/components/layout/admin-nav';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requirePageSession('admin');
  return (
    <div className="mx-auto max-w-5xl px-6">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4">
        <Link
          href="/admin"
          className="text-lg font-semibold hover:text-primary"
        >
          CCA Admin · Portal
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{session.user.username}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="py-8">
        <AdminNav />
        {children}
      </main>
    </div>
  );
}
