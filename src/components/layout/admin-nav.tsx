'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/shared/utils/cn';

const NAV_ITEMS = [
  { href: '/admin', label: 'Tổng quan', exact: true },
  { href: '/admin/users', label: 'Quản lý người dùng' },
  { href: '/admin/settings', label: 'Cài đặt hệ thống' },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-2 border-b border-border mb-8">
      {NAV_ITEMS.map((item) => {
        const isActive = item.exact
          ? pathname === item.href
          : pathname?.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              isActive
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
