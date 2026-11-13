// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { UserDetailPanel } from './user-detail-panel';

const account = {
  id: 'student-id',
  username: 'alice',
  role: 'student',
  status: 'active',
  firstLoginAt: '2026-11-12T12:00:00Z',
  lastLoginAt: null,
  createdAt: '2026-11-12T12:00:00Z',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('keeps the account visible after resetting a cycle and refreshes audit and results', async () => {
  const fetcher = vi.fn(async (path: string) => {
    if (path.endsWith('/reset-cycle')) return Response.json({ ok: true });
    if (path.endsWith('/audit'))
      return Response.json({
        logs: [
          {
            id: 'log',
            action: 'reset_exam_cycle',
            createdAt: account.createdAt,
            metadata: {},
          },
        ],
      });
    return Response.json({ results: [] });
  });
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(
    <UserDetailPanel user={account} audit={[]} currentAdminId="admin-id" />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Reset cycle/ }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    /Changes saved successfully/,
  );
  expect(screen.getByRole('heading', { name: 'alice' })).toBeVisible();
  expect(await screen.findByText('Exam cycle reset')).toBeVisible();
  expect(await screen.findByText('No completed exams yet.')).toBeVisible();
});

it('explains self restrictions and prevents changing the current admin account', () => {
  render(
    <UserDetailPanel
      user={{ ...account, role: 'admin' }}
      audit={[]}
      currentAdminId="student-id"
    />,
  );
  expect(
    screen.getByRole('button', { name: 'Disable account' }),
  ).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
  expect(
    screen.getByText(/You cannot disable or reset your own account here/),
  ).toBeVisible();
});

it('requires confirmation before locking an account', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(
    <UserDetailPanel user={account} audit={[]} currentAdminId="admin-id" />,
  );
  await userEvent.click(
    screen.getByRole('button', { name: 'Disable account' }),
  );
  expect(fetcher).not.toHaveBeenCalled();
});

it('shows a network error and allows retrying a failed mutation', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(
    <UserDetailPanel user={account} audit={[]} currentAdminId="admin-id" />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/connect/);
  expect(screen.getByRole('button', { name: 'Reset password' })).toBeEnabled();
});

it('reports denied history requests without displaying an empty successful result', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            message: 'You do not have permission to perform this action.',
          },
        },
        { status: 403 },
      ),
    ),
  );
  render(
    <UserDetailPanel user={account} audit={[]} currentAdminId="admin-id" />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Load history/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Unable to complete the request',
  );
  expect(screen.queryByText('No completed exams yet.')).not.toBeInTheDocument();
});

it('blocks duplicate mutations while a request is pending', async () => {
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(Response.json({ logs: [] })),
  );
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  render(
    <UserDetailPanel user={account} audit={[]} currentAdminId="admin-id" />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Reset password' }));
  expect(
    screen.getByRole('button', { name: 'Disable account' }),
  ).toBeDisabled();
  finish(Response.json({ user: { ...account, status: 'pending_password' } }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Disable account' }),
    ).toBeEnabled(),
  );
});
