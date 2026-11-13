'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock3,
  History,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdminFeedback } from '@/components/ui/admin-feedback';
import { adminRequest, errorMessage } from '@/shared/utils/admin-request';
import type { Summary } from '@/modules/exams/contracts/dto';
import {
  type AdminUser,
  cardClass,
  formatDate,
  inputClass,
  RoleBadge,
  StatusBadge,
} from './account-presentation';

type Audit = {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};
const auditLabels: Record<string, string> = {
  create_user: 'Tạo tài khoản',
  disable_user: 'Khóa tài khoản',
  enable_user: 'Mở khóa tài khoản',
  reset_password: 'Đặt lại mật khẩu',
  reset_exam_cycle: 'Đặt lại chu kỳ thi',
};
const resultLabels: Record<string, string> = {
  submitted: 'Đã nộp',
  abandoned: 'Đã rời bài',
  timed_out: 'Hết giờ',
};

export function UserDetailPanel({
  user: initial,
  audit: initialAudit,
  currentAdminId,
}: {
  user: AdminUser;
  audit: Audit[];
  currentAdminId: string;
}) {
  const [user, setUser] = useState(initial);
  const [audit, setAudit] = useState(initialAudit);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState('');
  const [results, setResults] = useState<Summary[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  const [topicId, setTopicId] = useState('cca-f');
  const base = `/api/v1/admin/users/${user.id}`;
  const self = user.id === currentAdminId;
  const disabled = user.status === 'disabled';
  const busy = Boolean(pending) || loadingResults;

  async function readResults() {
    setResults(
      (await adminRequest<{ results: Summary[] }>(`${base}/results`)).results,
    );
  }
  async function loadResults() {
    if (busy) return;
    setLoadingResults(true);
    setError('');
    try {
      await readResults();
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setLoadingResults(false);
    }
  }
  async function action(kind: 'status' | 'reset-password' | 'reset-cycle') {
    if (
      busy ||
      (self && kind !== 'reset-cycle') ||
      (disabled && kind !== 'status')
    )
      return;
    const confirmations = {
      status: disabled
        ? `Mở khóa tài khoản “${user.username}”? Người dùng cần đăng nhập lại.`
        : `Khóa tài khoản “${user.username}”? Tất cả phiên đăng nhập sẽ bị thu hồi và bài thi đang làm sẽ kết thúc.`,
      'reset-password': `Đặt lại mật khẩu cho “${user.username}”? Phiên đăng nhập sẽ bị thu hồi và bài thi đang làm sẽ kết thúc. Người dùng nhập username để tự đặt mật khẩu mới.`,
      'reset-cycle': `Đặt lại chu kỳ ${topicId.toUpperCase()} cho “${user.username}”? Bài thi đang làm trong chu kỳ sẽ kết thúc. Kết quả cũ được giữ trong lịch sử.`,
    };
    if (!window.confirm(confirmations[kind])) return;
    setPending(kind);
    setError('');
    setSuccess('');
    try {
      const data = await adminRequest<{ user?: AdminUser; ok?: boolean }>(
        `${base}/${kind}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            kind === 'status'
              ? { disabled: !disabled }
              : kind === 'reset-cycle'
                ? { topicId }
                : {},
          ),
        },
      );
      if (data.user) setUser(data.user);
      setSuccess(
        kind === 'status'
          ? `Đã ${disabled ? 'mở khóa' : 'khóa'} tài khoản.`
          : kind === 'reset-password'
            ? 'Đã đặt lại mật khẩu. Người dùng nhập username để đặt mật khẩu mới.'
            : `Đã đặt lại chu kỳ ${topicId.toUpperCase()}. Kết quả cũ được giữ nguyên.`,
      );
      const refreshes = await Promise.allSettled([
        adminRequest<{ logs: Audit[] }>(`${base}/audit`).then((logs) =>
          setAudit(logs.logs),
        ),
        ...(kind === 'reset-cycle' || results !== null ? [readResults()] : []),
      ]);
      if (refreshes.some((r) => r.status === 'rejected'))
        setError(
          'Thao tác đã hoàn tất nhưng chưa tải lại được lịch sử. Vui lòng tải lại trang.',
        );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setPending('');
    }
  }

  return (
    <section className="space-y-6">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Danh sách tài khoản
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Chi tiết tài khoản
          </p>
          <h1 className="break-all text-3xl font-semibold tracking-tight">
            {user.username}
          </h1>
          <div className="mt-3 flex items-center gap-2">
            <RoleBadge role={user.role} />
            <StatusBadge status={user.status} />
            {self && (
              <span className="text-xs text-muted-foreground">
                Tài khoản của bạn
              </span>
            )}
          </div>
        </div>
        <span className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
          {user.role === 'admin'
            ? 'Truy cập quản trị hệ thống'
            : 'Chỉ truy cập dữ liệu cá nhân'}
        </span>
      </div>
      <AdminFeedback success={success} />
      <AdminFeedback error={error} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          <section
            className={`${cardClass} p-5 sm:p-6`}
            aria-labelledby="access-heading"
          >
            <h2
              id="access-heading"
              className="flex items-center gap-2 font-semibold"
            >
              <LockKeyhole aria-hidden="true" className="size-4 text-primary" />
              Quyền truy cập
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {user.role === 'admin'
                ? 'Quản trị viên có quyền quản lý tài khoản, xem kết quả, đặt lại chu kỳ thi và cấu hình hệ thống.'
                : 'Học viên có quyền làm bài thi và xem kết quả của chính mình. Không có quyền truy cập trang quản trị.'}
            </p>
            <dl className="mt-5 grid gap-4 border-t border-border pt-5 sm:grid-cols-3">
              {[
                { label: 'Ngày tạo', date: user.createdAt },
                { label: 'Kích hoạt lần đầu', date: user.firstLoginAt },
                { label: 'Đăng nhập gần nhất', date: user.lastLoginAt },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-xs text-muted-foreground">
                    {item.label}
                  </dt>
                  <dd className="mt-1.5 text-sm font-medium">
                    {item.date ? formatDate(item.date) : 'Chưa có'}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section
            className={`${cardClass} overflow-hidden`}
            aria-labelledby="results-heading"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
              <h2 id="results-heading" className="font-semibold">
                Kết quả thi
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={loadResults}
                disabled={busy}
              >
                <History aria-hidden="true" className="size-3.5" />
                {loadingResults
                  ? 'Đang tải…'
                  : results === null
                    ? 'Tải lịch sử'
                    : 'Làm mới lịch sử'}
              </Button>
            </div>
            {results === null || results.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <History
                  aria-hidden="true"
                  className="mx-auto mb-3 size-7 text-muted-foreground/50"
                />
                <p className="text-sm text-muted-foreground">
                  {results === null
                    ? 'Tải lịch sử để xem các bài thi đã kết thúc.'
                    : 'Chưa có kết quả thi.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                      {['Bài thi', 'Kết thúc', 'Kết quả', 'Trạng thái'].map(
                        (label) => (
                          <th
                            scope="col"
                            key={label}
                            className="whitespace-nowrap px-5 py-3 font-medium"
                          >
                            {label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {results.map((r) => (
                      <tr key={r.id}>
                        <td className="whitespace-nowrap px-5 py-4 font-medium">
                          {r.topicId.toUpperCase()}
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            Đề {r.formNumber}
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground">
                          {formatDate(r.endedAt)}
                        </td>
                        <td className="px-5 py-4 font-medium tabular-nums">
                          {r.correct}/{r.total}
                          <p className="mt-1 text-xs font-normal text-muted-foreground">
                            {Math.round(r.percent)}%
                          </p>
                        </td>
                        <td className="whitespace-nowrap px-5 py-4 text-xs">
                          {resultLabels[r.status] ?? r.status}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <section
            className={`${cardClass} p-5 sm:p-6`}
            aria-labelledby="audit-heading"
          >
            <h2
              id="audit-heading"
              className="mb-5 flex items-center gap-2 font-semibold"
            >
              <Clock3 aria-hidden="true" className="size-4 text-primary" />
              Nhật ký quản trị
            </h2>
            {audit.length ? (
              <ol className="space-y-0">
                {audit.map((entry) => (
                  <li
                    key={entry.id}
                    className="relative ml-1 border-l border-border py-3 pl-5 first:pt-0 last:pb-0"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-1 top-4 size-2 rounded-full bg-primary first:top-1"
                    />
                    <p className="text-sm font-medium">
                      {auditLabels[entry.action] ?? entry.action}
                      {typeof entry.metadata.topicId === 'string' && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {entry.metadata.topicId.toUpperCase()}
                        </span>
                      )}
                    </p>
                    <time
                      dateTime={entry.createdAt}
                      className="mt-1 block text-xs text-muted-foreground"
                    >
                      {formatDate(entry.createdAt)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">
                Chưa có thao tác quản trị nào.
              </p>
            )}
          </section>
        </div>
        <aside className="space-y-5">
          <section className={`${cardClass} p-5`}>
            <h2 className="font-semibold">Quản lý tài khoản</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Thao tác khóa hoặc đặt lại mật khẩu sẽ thu hồi phiên và kết thúc
              bài thi đang làm.
            </p>
            {self && (
              <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                Không thể khóa hoặc đặt lại mật khẩu tài khoản đang đăng nhập.
              </p>
            )}
            {disabled && (
              <p className="mt-4 rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                Mở khóa tài khoản trước khi đặt lại mật khẩu hoặc chu kỳ thi.
              </p>
            )}
            <div className="mt-5 space-y-3">
              <Button
                variant="outline"
                className="w-full"
                disabled={self || busy}
                onClick={() => action('status')}
              >
                <LockKeyhole aria-hidden="true" className="size-4" />
                {pending === 'status'
                  ? 'Đang cập nhật…'
                  : disabled
                    ? 'Mở khóa'
                    : 'Khóa tài khoản'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={self || disabled || busy}
                onClick={() => action('reset-password')}
              >
                <KeyRound aria-hidden="true" className="size-4" />
                {pending === 'reset-password'
                  ? 'Đang đặt lại…'
                  : 'Đặt lại mật khẩu'}
              </Button>
            </div>
          </section>
          <section className={`${cardClass} p-5`}>
            <h2 className="font-semibold">Đặt lại lượt thi</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              Mở chu kỳ mới cho chủ đề đã chọn. Kết quả cũ luôn được giữ trong
              lịch sử.
            </p>
            <label
              htmlFor="reset-topic"
              className="mb-1.5 mt-5 block text-xs font-medium"
            >
              Chủ đề
            </label>
            <select
              id="reset-topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={disabled || busy}
              className={inputClass}
            >
              <option value="cca-f">CCA-F</option>
              <option value="ccao-f">CCAO-F</option>
              <option value="ccar-p">CCAR-P</option>
            </select>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={() => action('reset-cycle')}
              disabled={disabled || busy}
            >
              {pending === 'reset-cycle' ? 'Đang đặt lại…' : 'Đặt lại chu kỳ'}
            </Button>
          </section>
        </aside>
      </div>
    </section>
  );
}
