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
  'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60';
export const cardClass =
  'rounded-2xl border border-border bg-surface shadow-xs';
export function formatDate(value: string | number | null) {
  if (value === null) return 'Chưa đăng nhập';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
}
export function RoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ${role === 'admin' ? 'bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200' : 'bg-muted/60 text-muted-foreground'}`}
    >
      {role === 'admin' ? 'Quản trị viên' : 'Học viên'}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:
      'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    pending_password:
      'bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    disabled: 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200',
  };
  const labels: Record<string, string> = {
    active: 'Đang hoạt động',
    pending_password: 'Chờ đặt mật khẩu',
    disabled: 'Đã khóa',
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {labels[status] ?? status}
    </span>
  );
}
