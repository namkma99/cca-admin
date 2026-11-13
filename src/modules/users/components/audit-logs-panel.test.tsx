// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { AuditLogsPanel } from './audit-logs-panel';
const entry = {
  id: 'log',
  action: 'create_user' as const,
  actorUserId: 'admin',
  targetUserId: 'student',
  actorUsername: 'admin',
  targetUsername: 'alice',
  metadata: { username: 'alice' },
  createdAt: '2026-11-13T00:00:00Z',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('keeps existing logs after a failed filter request, then retries the requested filters', async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockImplementation(async (url: string) => {
        const params = new URL(url, 'http://localhost').searchParams;
        if (params.get('q') === 'missing')
          return Response.json({ logs: [], total: 0, page: 1, pageSize: 25 });
        return Response.json({
          logs: [entry],
          total: 1,
          page: 1,
          pageSize: 25,
        });
      }),
  );
  render(
    <AuditLogsPanel
      initialData={{ logs: [entry], total: 1, page: 1, pageSize: 25 }}
    />,
  );
  await user.type(screen.getByLabelText('Search accounts'), 'missing');
  await user.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByRole('link', { name: 'alice' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Retry' }));
  expect(await screen.findByText('No audit logs found')).toBeVisible();
});
