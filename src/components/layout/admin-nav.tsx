'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Settings2,
  UsersRound,
  ScrollText,
} from 'lucide-react';
import { cn } from '@/shared/utils/cn';

const items = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: UsersRound },
  { href: '/admin/audit-logs', label: 'Audit logs', icon: ScrollText },
  { href: '/admin/settings', label: 'Settings', icon: Settings2 },
];
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Admin navigation"
      className="grid grid-cols-4 gap-1 lg:flex lg:flex-col"
    >
      {items.map(({ icon: Icon, ...item }) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex flex-col items-center justify-center gap-2 rounded-lg px-1 py-2.5 text-[11px] font-medium sm:text-sm lg:flex-row lg:justify-start lg:gap-2.5 lg:px-3 transition-colors focus-visible:outline-2 focus-visible:outline-ring',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
