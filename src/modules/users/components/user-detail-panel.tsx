'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/shared/http/request-json';
import type { Summary } from '@/modules/exams/contracts/dto';
import type { AuditEntry } from '../contracts/audit';
import {
  type AdminUser,
  AuditList,
  cardClass,
  dateTime,
  Feedback,
  inputClass,
  label,
  StatusBadge,
} from './admin-ui';

export function UserDetailPanel({
  user: initial,
  audit: initialAudit,
  currentAdminId,
}: {
  user: AdminUser;
  audit: AuditEntry[];
  currentAdminId: string;
}) {
  const [user, setUser] = useState(initial);
  const [audit, setAudit] = useState(initialAudit);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [results, setResults] = useState<Summary[] | null>(null);
  const [topicId, setTopicId] = useState('cca-f');
  const disabled = user.status === 'disabled';
  const self = user.id === currentAdminId;
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
  async function loadResults() {
    const data = await requestJson<{ results: Summary[] }>(
      `/api/v1/admin/users/${user.id}/results`,
    );
    setResults(data.results);
  }
  async function action(path: string, body: unknown = {}) {
    const data = await requestJson<{ user: AdminUser }>(
      `/api/v1/admin/users/${user.id}/${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    // Reset-cycle returns the updated history, rather than a user record.
    if (data.user) setUser(data.user);
    setSuccess('Changes saved successfully.');
    try {
      const logs = await requestJson<{ logs: AuditEntry[] }>(
        `/api/v1/admin/users/${user.id}/audit`,
      );
      setAudit(logs.logs);
    } catch {
      setError(
        'Changes were saved, but the audit history could not be refreshed. Refresh the page to retry.',
      );
    }
  }
  return (
    <section className="space-y-6" aria-busy={pending}>
      <Link
        href="/admin/users"
        className="text-sm text-primary hover:underline"
      >
        ← Back to users
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">User details</p>
          <h1 className="mt-1 break-all text-3xl font-semibold tracking-tight">
            {user.username}
          </h1>
        </div>
        <StatusBadge status={user.status} />
      </div>
      <Feedback error={error} success={success} />
      <div className={cardClass}>
        <h2 className="text-lg font-semibold">Account information</h2>
        <dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Role', label(user.role)],
            ['Created (UTC)', dateTime(user.createdAt)],
            ['First sign-in (UTC)', dateTime(user.firstLoginAt)],
            ['Last sign-in (UTC)', dateTime(user.lastLoginAt)],
          ].map(([key, value]) => (
            <div key={key}>
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="mt-1 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className={cardClass}>
        <h2 className="text-lg font-semibold">Account actions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Disabling an account or resetting its password ends its sessions and
          finalizes active exams.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={pending || self}
            onClick={() => {
              if (
                window.confirm(
                  disabled
                    ? `Enable ${user.username}?`
                    : `Disable ${user.username}? Active sessions will end and any active exam will be finalized.`,
                )
              )
                void run(() => action('status', { disabled: !disabled }));
            }}
          >
            {disabled ? 'Enable account' : 'Disable account'}
          </Button>
          <Button
            variant="outline"
            disabled={pending || disabled || self}
            onClick={() => {
              if (
                window.confirm(
                  `Reset the password for ${user.username}? Active sessions will end and any active exam will be finalized. They will choose a new password on their next sign-in.`,
                )
              )
                void run(() => action('reset-password'));
            }}
          >
            Reset password
          </Button>
        </div>
        {self && (
          <p className="mt-3 text-xs text-muted-foreground">
            You cannot disable or reset your own account here.
          </p>
        )}
        {disabled && (
          <p className="mt-3 text-xs text-muted-foreground">
            Enable this account before resetting its password or exam cycle.
          </p>
        )}
      </div>
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Exam results</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Up to 200 recent completed attempts · All times in UTC
            </p>
          </div>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => run(loadResults)}
          >
            {pending
              ? 'Please wait…'
              : results === null
                ? 'Load history'
                : 'Refresh history'}
          </Button>
        </div>
        {results === null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Load history to view this user’s completed exams.
          </p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No completed exams yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Completed exam attempts</caption>
              <thead>
                <tr>
                  <th>Topic</th>
                  <th>Form</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Correct</th>
                  <th>Wrong</th>
                  <th>Unanswered</th>
                  <th>Ended (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result) => (
                  <tr key={result.id}>
                    <td className="font-medium">
                      {result.topicId.toUpperCase()}
                    </td>
                    <td>{result.formNumber}</td>
                    <td>
                      <StatusBadge status={result.status} />
                    </td>
                    <td>{Math.round(result.percent * 100) / 100}%</td>
                    <td>
                      {result.correct}/{result.total}
                    </td>
                    <td>{result.wrong}</td>
                    <td>{result.unanswered}</td>
                    <td className="whitespace-nowrap">
                      {dateTime(result.endedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-semibold">Reset exam cycle</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Allow another cycle for the selected topic. Previous results remain
            in history. Any active attempt in this topic will be finalized.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <label className="grid gap-1.5 text-sm">
              Topic
              <select
                value={topicId}
                onChange={(event) => setTopicId(event.target.value)}
                className={inputClass}
                disabled={pending}
              >
                {['cca-f', 'ccao-f', 'ccar-p'].map((topic) => (
                  <option key={topic} value={topic}>
                    {topic.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              className="self-end"
              disabled={pending || disabled}
              onClick={() => {
                if (
                  window.confirm(
                    `Reset the ${topicId.toUpperCase()} cycle? Any active attempt in this topic will be finalized. Previous results will remain in history.`,
                  )
                )
                  void run(async () => {
                    await action('reset-cycle', { topicId });
                    await loadResults();
                  });
              }}
            >
              Reset cycle
            </Button>
          </div>
        </div>
      </div>
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Audit history</h2>
          <Link
            className="text-sm text-primary hover:underline"
            href={`/admin/audit-logs?q=${encodeURIComponent(user.username)}`}
          >
            View all matching logs →
          </Link>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Recent account actions · All times in UTC
        </p>
        <AuditList entries={audit} />
      </div>
    </section>
  );
}
