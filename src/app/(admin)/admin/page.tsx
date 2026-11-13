import Link from 'next/link';
import { Users, Settings, ScrollText, ArrowUpRight } from 'lucide-react';
import { requirePageSession } from '@/modules/auth/server/page-session';

const tools = [
  {
    title: 'User management',
    description:
      'Create student accounts, manage access and review exam results.',
    href: '/admin/users',
    icon: Users,
    action: 'Manage users',
  },
  {
    title: 'Audit logs',
    description:
      'Review account changes, password resets and exam cycle resets across all users.',
    href: '/admin/audit-logs',
    icon: ScrollText,
    action: 'View audit logs',
  },
  {
    title: 'System settings',
    description:
      'Configure exam duration, forms per cycle and system preferences.',
    href: '/admin/settings',
    icon: Settings,
    action: 'Manage settings',
  },
];
export default async function AdminPage() {
  const session = await requirePageSession('admin');
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-primary">Administration</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome, {session.user.username}. Manage your CCA exam portal.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {tools.map(({ icon: Icon, ...tool }) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="group flex flex-col rounded-xl border border-border bg-background p-6 shadow-xs transition-colors hover:border-primary"
          >
            <span className="mb-5 inline-flex w-fit rounded-lg bg-primary/10 p-3 text-primary">
              <Icon size={24} aria-hidden="true" />
            </span>
            <h2 className="text-lg font-semibold">{tool.title}</h2>
            <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
              {tool.description}
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
              {tool.action}
              <ArrowUpRight size={16} aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
        Start with Users to create a student account. Each student sets their
        own password when they first sign in.
      </div>
    </div>
  );
}
