import type { ReactNode } from 'react';
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
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border py-6">
        <p className="font-semibold">CCA Admin · {session.user.username}</p>
        <LogoutButton />
      </header>
      <main className="py-10">{children}</main>
    </div>
  );
}
