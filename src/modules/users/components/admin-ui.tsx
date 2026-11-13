import { auditActions, type AuditEntry } from '../contracts/audit';

export type AdminUser = {
  id: string;
  username: string;
  role: string;
  status: string;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};
export const inputClass =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring';
export const cardClass =
  'rounded-xl border border-border bg-background p-5 shadow-xs sm:p-6';
const labels: Record<string, string> = {
  active: 'Active',
  disabled: 'Disabled',
  pending_password: 'Pending password',
  admin: 'Administrator',
  student: 'Student',
  submitted: 'Submitted',
  abandoned: 'Abandoned',
  timed_out: 'Timed out',
};
export const label = (value: string) => labels[value] ?? value;
export function dateTime(value: string | number | null) {
  if (value === null) return 'Never';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}
export function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'active' || status === 'submitted'
      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200'
      : status === 'disabled' || status === 'abandoned'
        ? 'bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
        : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200';
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${color}`}
    >
      {label(status)}
    </span>
  );
}
export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (error)
    return (
      <p
        role="alert"
        className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-100"
      >
        {error}
      </p>
    );
  if (success)
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100"
      >
        {success}
      </p>
    );
  return null;
}
export function AuditDetails({ entry }: { entry: AuditEntry }) {
  const items = Object.entries(entry.metadata);
  return items.length ? (
    <details className="text-sm">
      <summary className="cursor-pointer text-primary">View details</summary>
      <dl className="mt-2 space-y-1 break-words">
        {items.map(([key, value]) => (
          <div key={key}>
            <dt className="inline font-medium">{key.replaceAll('_', ' ')}: </dt>
            <dd className="inline">
              {typeof value === 'string' ? label(value) : JSON.stringify(value)}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  ) : (
    <span className="text-muted-foreground">No additional details</span>
  );
}
export function AuditList({ entries }: { entries: AuditEntry[] }) {
  return entries.length ? (
    <ol className="mt-4 divide-y divide-border">
      {entries.map((entry) => (
        <li key={entry.id} className="space-y-2 py-4">
          <div className="flex flex-wrap justify-between gap-2">
            <strong className="text-sm">{auditActions[entry.action]}</strong>
            <time
              className="text-xs text-muted-foreground"
              dateTime={entry.createdAt}
            >
              {dateTime(entry.createdAt)} UTC
            </time>
          </div>
          <p className="break-all text-xs text-muted-foreground">
            Actor: {entry.actorUsername ?? entry.actorUserId}
          </p>
          <AuditDetails entry={entry} />
        </li>
      ))}
    </ol>
  ) : (
    <p className="py-6 text-sm text-muted-foreground">
      No audit events recorded.
    </p>
  );
}
