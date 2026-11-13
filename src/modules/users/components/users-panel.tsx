'use client';
import { type FormEvent, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Search, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminFeedback } from '@/components/ui/admin-feedback';
import { adminRequest, errorMessage } from '@/shared/utils/admin-request';
import {
  type AdminUser,
  cardClass,
  formatDate,
  inputClass,
  RoleBadge,
  StatusBadge,
} from './account-presentation';

export function UsersPanel({
  initialUsers = [],
  currentAdminId,
}: {
  initialUsers?: AdminUser[];
  currentAdminId?: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const filtered = users.filter(
    (u) =>
      u.username.includes(query.trim().toLowerCase()) &&
      (role === 'all' || u.role === role) &&
      (status === 'all' || u.status === status),
  );
  async function reload() {
    if (loading) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      setUsers(
        (await adminRequest<{ users: AdminUser[] }>('/api/v1/admin/users'))
          .users,
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    if (creating) return;
    setCreating(true);
    setError('');
    setSuccess('');
    try {
      const { user } = await adminRequest<{ user: AdminUser }>(
        '/api/v1/admin/users',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: username.trim().toLowerCase() }),
        },
      );
      setUsers((rows) =>
        [...rows, user].sort((a, b) => a.username.localeCompare(b.username)),
      );
      setQuery('');
      setRole('all');
      setStatus('all');
      setUsername('');
      setSuccess(
        `Đã tạo học viên “${user.username}”. Học viên nhập username để tự đặt mật khẩu khi đăng nhập lần đầu.`,
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setCreating(false);
    }
  }
  const stats = [
    { label: 'Tổng tài khoản', value: users.length },
    {
      label: 'Đang hoạt động',
      value: users.filter((u) => u.status === 'active').length,
    },
    {
      label: 'Chờ đặt mật khẩu',
      value: users.filter((u) => u.status === 'pending_password').length,
    },
    {
      label: 'Đã khóa',
      value: users.filter((u) => u.status === 'disabled').length,
    },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className={`${cardClass} p-4 sm:p-5`}>
            <p className="text-xs font-medium text-muted-foreground">
              {stat.label}
            </p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      <AdminFeedback error={error} success={success} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section
          className={`${cardClass} min-w-0 overflow-hidden`}
          aria-label="Danh sách tài khoản"
        >
          <div className="space-y-4 border-b border-border p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold">
                Danh sách tài khoản{' '}
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  ({filtered.length})
                </span>
              </h2>
              <Button
                variant="outline"
                size="sm"
                disabled={loading || creating}
                onClick={reload}
              >
                {loading ? 'Đang tải…' : 'Làm mới'}
              </Button>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-0 flex-1">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                />
                <input
                  aria-label="Tìm username"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm theo username…"
                  className={`${inputClass} pl-9`}
                />
              </div>
              <select
                aria-label="Lọc vai trò"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={`${inputClass} sm:w-auto`}
              >
                <option value="all">Tất cả vai trò</option>
                <option value="admin">Quản trị viên</option>
                <option value="student">Học viên</option>
              </select>
              <select
                aria-label="Lọc trạng thái"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className={`${inputClass} sm:w-auto`}
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="active">Đang hoạt động</option>
                <option value="pending_password">Chờ đặt mật khẩu</option>
                <option value="disabled">Đã khóa</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto" aria-busy={loading}>
            <table className="block w-full text-left text-sm sm:table">
              <thead className="hidden bg-muted/30 text-xs text-muted-foreground sm:table-header-group">
                <tr>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Tài khoản
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Vai trò
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Trạng thái
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="block divide-y divide-border sm:table-row-group">
                {filtered.map((u) => (
                  <tr
                    key={u.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 p-4 transition-colors hover:bg-muted/20 sm:table-row sm:p-0"
                  >
                    <td className="col-span-2 block sm:table-cell sm:px-5 sm:py-4">
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="break-all font-semibold text-foreground hover:text-primary hover:underline"
                      >
                        {u.username}
                      </Link>
                      {u.id === currentAdminId && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          Bạn
                        </span>
                      )}
                      <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                        {u.lastLoginAt
                          ? `Đăng nhập ${formatDate(u.lastLoginAt)}`
                          : 'Chưa đăng nhập'}
                      </p>
                    </td>
                    <td className="block sm:table-cell sm:px-4 sm:py-4">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="block sm:table-cell sm:px-4 sm:py-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="col-span-2 block sm:table-cell sm:px-4 sm:py-4">
                      <Link
                        aria-label={`Chi tiết ${u.username}`}
                        href={`/admin/users/${u.id}`}
                        className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:underline"
                      >
                        Chi tiết
                        <ArrowUpRight aria-hidden="true" className="size-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="flex flex-col items-center px-6 py-14 text-center">
                <Users
                  aria-hidden="true"
                  className="mb-3 size-8 text-muted-foreground/60"
                />
                <p className="text-sm font-medium">
                  {users.length
                    ? 'Không tìm thấy tài khoản phù hợp.'
                    : 'Chưa có tài khoản nào.'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {users.length
                    ? 'Thử username khác hoặc thay đổi bộ lọc.'
                    : 'Tạo học viên đầu tiên để bắt đầu.'}
                </p>
              </div>
            )}
          </div>
        </section>
        <aside className={`${cardClass} p-5`}>
          <div className="mb-4 flex items-center gap-2">
            <UserPlus aria-hidden="true" className="size-4 text-primary" />
            <h2 className="font-semibold">Tạo học viên</h2>
          </div>
          <p className="mb-5 text-sm leading-relaxed text-muted-foreground">
            Cấp username cho học viên. Học viên tự đặt mật khẩu ở lần đăng nhập
            đầu tiên.
          </p>
          <form onSubmit={create} className="space-y-4" aria-busy={creating}>
            <div>
              <label
                htmlFor="new-username"
                className="mb-1.5 block text-sm font-medium"
              >
                Username
              </label>
              <input
                id="new-username"
                required
                maxLength={64}
                autoCapitalize="none"
                autoComplete="off"
                spellCheck={false}
                disabled={creating}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                aria-describedby="username-help"
                placeholder="vd: nguyen.van.a"
                className={inputClass}
              />
              <p
                id="username-help"
                className="mt-2 text-xs leading-relaxed text-muted-foreground"
              >
                Chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang. Tối đa
                64 ký tự.
              </p>
            </div>
            <Button disabled={creating || loading} className="w-full">
              {creating ? 'Đang tạo…' : 'Tạo học viên'}
            </Button>
          </form>
          <div className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">
              Quyền mặc định: Học viên.
            </span>{' '}
            Tài khoản này chỉ truy cập bài thi và kết quả của chính mình.
          </div>
        </aside>
      </div>
    </div>
  );
}
