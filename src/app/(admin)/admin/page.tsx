import Link from 'next/link';
import {
  ArrowRight,
  Check,
  Minus,
  Settings2,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { requirePageSession } from '@/modules/auth/server/page-session';

const permissions = [
  { task: 'Làm bài thi, xem kết quả cá nhân', student: true },
  { task: 'Tạo, khóa và mở khóa học viên', student: false },
  { task: 'Đặt lại mật khẩu và chu kỳ thi', student: false },
  { task: 'Xem kết quả và nhật ký quản trị', student: false },
  { task: 'Thay đổi cài đặt hệ thống', student: false },
];
export default async function AdminPage() {
  const session = await requirePageSession('admin');
  return (
    <div className="space-y-7">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Không gian quản trị
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Tổng quan hệ thống
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Xin chào {session.user.username}. Quản lý tài khoản, quyền truy cập và
          kỳ thi CCA tại đây.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        {[
          {
            href: '/admin/users',
            title: 'Người dùng & quyền truy cập',
            description:
              'Tạo học viên, theo dõi trạng thái, quản lý truy cập và lịch sử thi.',
            icon: UsersRound,
            action: 'Quản lý người dùng',
          },
          {
            href: '/admin/settings',
            title: 'Cài đặt hệ thống',
            description:
              'Điều chỉnh thời gian làm bài, số đề thi và các thông số hệ thống.',
            icon: Settings2,
            action: 'Mở cài đặt',
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
            Phạm vi quyền truy cập
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Hai vai trò hiện tại và các thao tác được phép trong hệ thống.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-6 py-3 font-medium">
                  Chức năng
                </th>
                <th scope="col" className="px-4 py-3 text-center font-medium">
                  Học viên
                </th>
                <th scope="col" className="px-4 py-3 text-center font-medium">
                  Quản trị viên
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
                          aria-label="Được phép"
                          className="mx-auto size-4 text-emerald-600 dark:text-emerald-400"
                        />
                      ) : (
                        <Minus
                          aria-label="Không được phép"
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
        <h2 className="text-sm font-semibold">Luồng cấp tài khoản</h2>
        <ol className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          {[
            'Admin tạo username học viên',
            'Học viên nhập username và đặt mật khẩu',
            'Đăng nhập bằng mật khẩu ở các lần sau',
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
