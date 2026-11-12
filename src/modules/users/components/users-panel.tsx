'use client';
import { FormEvent, useState } from 'react';
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

export function UsersPanel({ initialUsers = [] }: { initialUsers?: User[] }) {
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [query, setQuery] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = async (value = query) => {
    const response = await fetch(
      `/api/v1/admin/users?q=${encodeURIComponent(value)}`,
      { credentials: 'include', cache: 'no-store' },
    );
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error?.message ?? 'Không thể tải danh sách.');
    }
    setUsers(body.users);
  };

  async function create(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSuccess('');
    const createdUsername = username;
    const response = await fetch('/api/v1/admin/users', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: createdUsername }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? 'Không thể tạo tài khoản.');
      return;
    }
    setSuccess(
      `Đã tạo học viên "${createdUsername}". Học viên sẽ tự đặt mật khẩu khi đăng nhập lần đầu.`,
    );
    setUsername('');
    await load();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={create}
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-4"
      >
        <label className="grid gap-1 text-sm">
          Username
          <input
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="rounded border border-border bg-background px-3 py-2"
          />
        </label>
        <button className="rounded bg-primary px-4 py-2 text-primary-foreground">
          Tạo học viên
        </button>
        {success && (
          <p
            role="status"
            className="rounded bg-green-100 px-3 py-2 text-sm text-green-950 dark:bg-green-950 dark:text-green-100"
          >
            {success}
          </p>
        )}
      </form>
      <div className="flex gap-2">
        <input
          aria-label="Tìm username"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) =>
            e.key === 'Enter' && load().catch((x) => setError(x.message))
          }
          placeholder="Tìm username"
          className="rounded border border-border bg-background px-3 py-2"
        />
        <button
          onClick={() => load().catch((x) => setError(x.message))}
          className="rounded border border-border px-4 py-2"
        >
          Tìm
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="p-3">Username</th>
              <th className="p-3">Vai trò</th>
              <th className="p-3">Trạng thái</th>
              <th className="p-3">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr
                key={user.id}
                className="border-b border-border last:border-0"
              >
                <td className="p-3">
                  <Link
                    className="text-primary underline"
                    href={`/admin/users/${user.id}`}
                  >
                    {user.username}
                  </Link>
                </td>
                <td className="p-3">{user.role}</td>
                <td className="p-3">{user.status}</td>
                <td className="p-3">
                  <Link href={`/admin/users/${user.id}`} className="underline">
                    Chi tiết
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
