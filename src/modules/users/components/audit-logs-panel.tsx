'use client';
import { type FormEvent, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/shared/http/request-json';
import { auditActions, type AuditPage } from '../contracts/audit';
import {
  AuditDetails,
  cardClass,
  dateTime,
  Feedback,
  inputClass,
} from './admin-ui';

export function AuditLogsPanel({
  initialData,
  initialQuery = '',
}: {
  initialData: AuditPage;
  initialQuery?: string;
}) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState(initialQuery);
  const [action, setAction] = useState('');
  const [applied, setApplied] = useState({ query: initialQuery, action: '' });
  const attempted = useRef({
    page: initialData.page,
    filters: { query: initialQuery, action: '' },
  });
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState('');
  async function load(page: number, filters = applied) {
    if (busy.current) return;
    attempted.current = { page, filters };
    busy.current = true;
    setPending(true);
    setError('');
    try {
      const params = new URLSearchParams({
        q: filters.query,
        action: filters.action,
        page: String(page),
        pageSize: String(data.pageSize),
      });
      const next = await requestJson<AuditPage>(
        `/api/v1/admin/audit-logs?${params}`,
      );
      setData(next);
      setApplied(filters);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Unable to load audit logs.',
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    void load(1, { query, action });
  }
  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <section className="space-y-6" aria-busy={pending}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Audit logs</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Track account changes and exam cycle resets performed by
          administrators.
        </p>
      </div>
      <div className={cardClass}>
        <form onSubmit={submit}>
          <fieldset
            disabled={pending}
            className="flex flex-wrap items-end gap-3"
          >
            <label className="grid flex-1 gap-1.5 text-sm font-medium">
              Search accounts
              <input
                type="search"
                maxLength={64}
                placeholder="Actor or target username…"
                className={inputClass}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Action
              <select
                className={inputClass}
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="">All actions</option>
                {Object.entries(auditActions).map(([value, title]) => (
                  <option key={value} value={value}>
                    {title}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit">
              {pending ? 'Loading…' : 'Apply filters'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuery('');
                setAction('');
                void load(1, { query: '', action: '' });
              }}
            >
              Clear filters
            </Button>
          </fieldset>
        </form>
      </div>
      <Feedback error={error} />
      {error && (
        <Button
          variant="outline"
          disabled={pending}
          onClick={() =>
            load(attempted.current.page, attempted.current.filters)
          }
        >
          Retry
        </Button>
      )}
      <div className={cardClass}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p role="status" className="text-sm text-muted-foreground">
            {data.total} events · All times in UTC
          </p>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() => load(data.page)}
          >
            Refresh
          </Button>
        </div>
        {data.logs.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Administrator audit events</caption>
              <thead>
                <tr>
                  <th>Time (UTC)</th>
                  <th>Action</th>
                  <th>Performed by</th>
                  <th>Target account</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap">
                      {dateTime(entry.createdAt)}
                    </td>
                    <td className="whitespace-nowrap font-medium">
                      {auditActions[entry.action]}
                    </td>
                    <td>
                      <Link
                        href={`/admin/users/${entry.actorUserId}`}
                        className="text-primary hover:underline"
                      >
                        {entry.actorUsername}
                      </Link>
                    </td>
                    <td>
                      <Link
                        href={`/admin/users/${entry.targetUserId}`}
                        className="text-primary hover:underline"
                      >
                        {entry.targetUsername}
                      </Link>
                    </td>
                    <td className="min-w-48">
                      <AuditDetails entry={entry} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 text-center">
            <h2 className="font-medium">No audit logs found</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {applied.query || applied.action
                ? 'Try changing or clearing the filters.'
                : 'Account actions performed by administrators will appear here.'}
            </p>
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Page {data.page} of {pages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={pending || data.page <= 1}
              onClick={() => load(data.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              disabled={pending || data.page >= pages}
              onClick={() => load(data.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
