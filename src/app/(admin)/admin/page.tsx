import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Minus,
  Settings2,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { requirePageSession } from '@/modules/auth/server/page-session';

const permissions = [
  { task: 'Take exams and view personal results', student: true },
  { task: 'Create, disable and enable students', student: false },
  { task: 'Reset passwords and exam cycles', student: false },
  { task: 'View exam results and audit logs', student: false },
  { task: 'Change system settings', student: false },
];
export default async function AdminPage() {
  const session = await requirePageSession('admin');
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Administration
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          System overview
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Welcome, {session.user.username}. Manage CCA accounts, access and
          exams here.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            href: '/admin/users',
            title: 'Users and access',
            description:
              'Create students, track account status, manage access and review exam history.',
            icon: UsersRound,
            action: 'User management',
          },
          {
            href: '/admin/audit-logs',
            title: 'Audit logs',
            description:
              'Review account changes, password resets and exam cycle resets across all users.',
            icon: ScrollText,
            action: 'View audit logs',
          },
          {
            href: '/admin/settings',
            title: 'System settings',
            description:
              'Configure exam duration, forms per cycle and system preferences.',
            icon: Settings2,
            action: 'Manage settings',
          },
        ].map(({ icon: Icon, ...item }) => (
          <Link
            key={item.href}
            href={item.href}
            className="group rounded-2xl border border-border bg-surface p-6 shadow-xs transition-colors hover:border-primary/60 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <h2 className="font-semibold">{item.title}</h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {item.description}
            </p>
            <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary">
              {item.action}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform group-hover:translate-x-1"
              />
            </span>
          </Link>
        ))}
      </div>
      <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        <div className="border-b border-border p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
            Access permissions
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Permissions available to each role in the system.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">
                  Capability
                </th>
                <th scope="col" className="px-4 py-3 text-center font-medium">
                  Student
                </th>
                <th scope="col" className="px-4 py-3 text-center font-medium">
                  Administrator
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {permissions.map((p) => (
                <tr key={p.task}>
                  <th scope="row" className="min-w-52 px-6 py-4 font-normal">
                    {p.task}
                  </th>
                  {[p.student, true].map((allowed, i) => (
                    <td key={i} className="px-4 py-4 text-center">
                      {allowed ? (
                        <Check
                          aria-label="Allowed"
                          className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
                        />
                      ) : (
                        <Minus
                          aria-label="Not allowed"
                          className="mx-auto size-4 text-muted-foreground/50"
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="rounded-2xl border border-border p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Account setup flow</h2>
        <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          {[
            'An administrator creates a student username',
            'The student enters their username and sets a password',
            'The student uses their password for future sign-ins',
          ].map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5 text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
