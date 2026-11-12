'use client';
import { useState } from 'react';
import Link from 'next/link';
type User = {
  id: string;
  username: string;
  role: string;
  status: string;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
};
type Audit = {
  id: string;
  action: string;
  createdAt: string;
  metadata: Record<string, unknown>;
};
export function UserDetailPanel({
  user: initial,
  audit: initialAudit,
  currentAdminId,
}: {
  user: User;
  audit: Audit[];
  currentAdminId: string;
}) {
  const [user, setUser] = useState(initial);
  const [audit, setAudit] = useState(initialAudit);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<unknown[]>([]);
  const [topicId, setTopicId] = useState('cca-f');
  async function action(path: string, body?: unknown) {
    setMessage('');
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error?.message ?? 'Thao tác thất bại.');
      return;
    }
    setUser(data.user);
    const logs = await fetch(`/api/v1/admin/users/${user.id}/audit`, {
      credentials: 'include',
    }).then((r) => r.json());
    setAudit(logs.logs ?? []);
  }
  async function loadResults() {
    const data = await fetch(`/api/v1/admin/users/${user.id}/results`, {
      credentials: 'include',
    }).then((r) => r.json());
    setResults(data.results ?? []);
  }
  async function resetTopic() {
    if (
      !window.confirm(
        `Đặt lại chu kỳ ${topicId}? Kết quả cũ sẽ được giữ nguyên trong lịch sử.`,
      )
    )
      return;
    await action(`/api/v1/admin/users/${user.id}/reset-cycle`, { topicId });
    await loadResults();
  }
  const disabled = user.status === 'disabled';
  return (
    <section className="space-y-8">
      <Link href="/admin/users" className="text-sm underline">
        ← Người dùng
      </Link>
      <div>
        <h1 className="text-3xl font-semibold">{user.username}</h1>
        <p className="mt-2 text-muted-foreground">
          {user.role} · {user.status}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <button
          disabled={user.id === currentAdminId}
          onClick={() =>
            action(`/api/v1/admin/users/${user.id}/status`, {
              disabled: !disabled,
            })
          }
          className="rounded border border-border px-4 py-2"
        >
          {disabled ? 'Mở khóa' : 'Khóa tài khoản'}
        </button>
        <button
          disabled={disabled || user.id === currentAdminId}
          onClick={() =>
            window.confirm(
              'Đặt lại mật khẩu cho tài khoản này? Người dùng sẽ tự đặt lại mật khẩu mới khi đăng nhập tiếp theo.',
            ) && action(`/api/v1/admin/users/${user.id}/reset-password`)
          }
          className="rounded border border-border px-4 py-2"
        >
          Đặt lại mật khẩu
        </button>
      </div>
      {message && (
        <p role="alert" className="text-sm text-red-700">
          {message}
        </p>
      )}
      <div className="space-y-3">
        <h2 className="text-xl font-semibold">Kết quả thi</h2>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={loadResults}
            className="rounded border border-border px-3 py-2"
          >
            Tải lịch sử
          </button>
          <select
            aria-label="Chủ đề"
            value={topicId}
            onChange={(e) => setTopicId(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
          >
            <option value="cca-f">CCA-F</option>
            <option value="ccao-f">CCAO-F</option>
            <option value="ccar-p">CCAR-P</option>
          </select>
          <button
            onClick={resetTopic}
            disabled={user.status === 'disabled'}
            className="rounded border border-border px-3 py-2"
          >
            Đặt lại chu kỳ (giữ lịch sử)
          </button>
        </div>
        <pre className="overflow-auto rounded bg-muted p-3 text-xs">
          {results.length
            ? JSON.stringify(results, null, 2)
            : 'Chưa tải lịch sử.'}
        </pre>
      </div>
      <div>
        <h2 className="text-xl font-semibold">Nhật ký quản trị</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {audit.map((entry) => (
            <li key={entry.id} className="rounded border border-border p-3">
              <strong>{entry.action}</strong> ·{' '}
              {new Date(entry.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
