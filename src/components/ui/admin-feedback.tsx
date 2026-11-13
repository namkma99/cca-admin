import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function AdminFeedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  if (!error && !success) return null;
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${error ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'}`}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <span>{error || success}</span>
    </div>
  );
}
