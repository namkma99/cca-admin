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
    <div className="admin-shell mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-4">
        <Link
          href="/admin"
          className="text-lg font-semibold hover:text-primary"
        >
          CCA Admin
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">{session.user.username}</span>
          <LogoutButton />
        </div>
      </header>
      <main id="admin-content" className="py-6 sm:py-8">
        <AdminNav />
        {children}
      </main>
    </div>
  );
}
