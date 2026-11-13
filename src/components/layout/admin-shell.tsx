import type { ReactNode } from 'react';
import Link from 'next/link';
import { GraduationCap, ShieldCheck } from 'lucide-react';
import { LogoutButton } from '@/modules/auth/components/logout-button';
import { AdminNav } from '@/components/layout/admin-nav';

export function AdminShell({
  children,
  username,
}: {
  children: ReactNode;
  username: string;
}) {
  return (
    <div className="admin-shell min-h-dvh">
      <a
        href="#admin-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3 focus:text-primary"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/admin" className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <GraduationCap aria-hidden="true" className="size-6" />
            </span>
            <span className="text-base font-bold tracking-tight">
              CCA Admin
              <span className="mt-0.5 block text-[11px] font-normal tracking-normal text-muted-foreground">
                Account and exam management
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-5">
            <div className="hidden text-right sm:block">
              <p className="max-w-48 truncate text-sm font-semibold">
                {username}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Administrator
              </p>
            </div>
            <LogoutButton />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1440px] lg:grid-cols-[200px_minmax(0,1fr)]">
        <aside className="border-b border-border px-4 py-3 lg:min-h-[calc(100dvh-81px)] lg:border-b-0 lg:border-r lg:px-4 lg:py-7">
          <div className="lg:sticky lg:top-6">
            <p className="mb-3 hidden px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground lg:block">
              Administration
            </p>
            <AdminNav />
            <div className="mx-3 mt-10 hidden border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground lg:block">
              <ShieldCheck
                aria-hidden="true"
                className="mb-2 size-4 text-primary"
              />
              You are signed in as an administrator.
            </div>
          </div>
        </aside>
        <main
          id="admin-content"
          tabIndex={-1}
          className="min-w-0 p-4 py-6 outline-none sm:p-6 lg:p-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
