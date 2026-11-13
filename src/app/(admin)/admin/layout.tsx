import type { ReactNode } from 'react';
import { requirePageSession } from '@/modules/auth/server/page-session';
import { AdminShell } from '@/components/layout/admin-shell';

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requirePageSession('admin');
  return <AdminShell username={session.user.username}>{children}</AdminShell>;
}
