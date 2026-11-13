'use client';
import { type FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/shared/http/request-json';
import {
  type AdminUser,
  cardClass,
  dateTime,
  Feedback,
  inputClass,
  label,
  StatusBadge,
} from './admin-ui';

export function UsersPanel({
  initialUsers = [],
  currentAdminId,
}: {
  initialUsers?: AdminUser[];
  currentAdminId?: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  async function run(work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError('');
    setSuccess('');
    try {
      await work();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to complete the request.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function load() {
    const data = await requestJson<{ users: AdminUser[] }>(
      '/api/v1/admin/users',
    );
    setUsers(data.users);
  }
  async function create(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      const data = await requestJson<{ user: AdminUser }>(
        '/api/v1/admin/users',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username }),
        },
      );
      setUsers((current) =>
        [...current, data.user].sort((a, b) =>
          a.username.localeCompare(b.username),
        ),
      );
      setUsername('');
      setQuery('');
      setStatus('');
      setRole('');
      setSuccess(
        `Student "${data.user.username}" created. They will set their password when they first sign in.`,
      );
    });
  }
  const filtered = users.filter(
    (user) =>
      user.username.toLowerCase().includes(query.trim().toLowerCase()) &&
      (!status || user.status === status) &&
      (!role || user.role === role),
  );
  return (
    <div className="space-y-6" aria-busy={pending}>
      <form onSubmit={create} className={cardClass}>
        <h2 className="text-lg font-semibold">Create student account</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Students choose their own password on first sign-in.
        </p>
        <fieldset
          disabled={pending}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <label className="grid w-full gap-1.5 text-sm font-medium sm:w-72">
            Username
            <input
              required
              maxLength={64}
              pattern="[a-zA-Z0-9][a-zA-Z0-9._\-]*"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className={inputClass}
              aria-describedby="username-hint"
            />
          </label>
          <Button type="submit">
            {pending ? 'Please wait…' : 'Create student'}
          </Button>
        </fieldset>
        <p id="username-hint" className="mt-2 text-xs text-muted-foreground">
          Up to 64 characters. Use letters, numbers, periods, underscores or
          hyphens.
        </p>
      </form>
      <Feedback error={error} success={success} />
      <div className={cardClass}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="grid flex-1 gap-1.5 text-sm font-medium">
            Search users
            <input
              type="search"
              placeholder="Search by username…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={inputClass}
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Role
            <select
              className={inputClass}
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="">All roles</option>
              <option value="admin">Administrator</option>
              <option value="student">Student</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className={inputClass}
            >
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="pending_password">Pending password</option>
              <option value="disabled">Disabled</option>
            </select>
          </label>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => run(load)}
          >
            {pending ? 'Loading…' : 'Refresh'}
          </Button>
        </div>
        <p role="status" className="mt-4 text-xs text-muted-foreground">
          {filtered.length} of {users.length} users · All times in UTC
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">User accounts</caption>
            <thead>
              <tr>
                <th>Username</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last sign-in</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id}>
                  <td>
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/admin/users/${user.id}`}
                    >
                      {user.username}
                    </Link>
                    {user.id === currentAdminId && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        You
                      </span>
                    )}
                  </td>
                  <td>{label(user.role)}</td>
                  <td>
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="whitespace-nowrap">
                    {dateTime(user.createdAt)}
                  </td>
                  <td className="whitespace-nowrap">
                    {dateTime(user.lastLoginAt)}
                  </td>
                  <td>
                    <Link
                      aria-label={`View ${user.username}`}
                      className="text-primary hover:underline"
                      href={`/admin/users/${user.id}`}
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!filtered.length && (
          <div className="py-12 text-center">
            <h3 className="font-medium">No users found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {users.length
                ? 'Try another search or status filter.'
                : 'Create a student account to get started.'}
            </p>
            {(query || status || role) && (
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setStatus('');
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
