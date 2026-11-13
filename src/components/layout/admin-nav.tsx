'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, ScrollText, Settings } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/audit-logs', label: 'Audit logs', icon: ScrollText },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
];
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin navigation"
      className="mb-8 flex gap-1 overflow-x-auto border-b border-border"
    >
      {NAV_ITEMS.map(({ icon: Icon, ...item }) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors sm:px-4',
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:border-border hover:text-foreground',
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
