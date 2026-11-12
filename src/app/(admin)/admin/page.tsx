import Link from 'next/link';
import { requirePageSession } from '@/modules/auth/server/page-session';

export default async function AdminPage() {
  await requirePageSession('admin');
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold">Quản trị hệ thống CCA</h1>
        <p className="mt-2 text-muted-foreground">
          Bảng điều khiển quản trị viên và các công cụ quản lý.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-6 shadow-xs space-y-4">
          <h2 className="text-xl font-semibold">Quản lý người dùng</h2>
          <p className="text-sm text-muted-foreground">
            Tạo tài khoản học viên, quản lý danh sách, khóa/mở khóa tài khoản và
            đặt lại mật khẩu.
          </p>
          <Link
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            href="/admin/users"
          >
            Quản lý người dùng →
          </Link>
        </div>

        <div className="rounded-lg border border-border p-6 shadow-xs space-y-4">
          <h2 className="text-xl font-semibold">Cài đặt hệ thống</h2>
          <p className="text-sm text-muted-foreground">
            Cấu hình thời gian thi, số lượng đề ngẫu nhiên, điểm chuẩn đạt và
            tùy chọn hiển thị.
          </p>
          <Link
            className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            href="/admin/settings"
          >
            Cài đặt hệ thống →
          </Link>
        </div>
      </div>
    </div>
  );
}
