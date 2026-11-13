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
  await userEvent.click(screen.getByRole('button', { name: /Đặt lại chu kỳ/ }));
  expect(await screen.findByRole('status')).toHaveTextContent(
    /Đã đặt lại chu kỳ/,
  );
  expect(screen.getByRole('heading', { name: 'alice' })).toBeVisible();
  expect(await screen.findByText('Đặt lại chu kỳ thi')).toBeVisible();
  expect(await screen.findByText('Chưa có kết quả thi.')).toBeVisible();
});

it('explains self restrictions and prevents changing the current admin account', () => {
  render(
    <UserDetailPanel
      user={{ ...account, role: 'admin' }}
      audit={[]}
      currentAdminId="student-id"
    />,
  );
  expect(screen.getByRole('button', { name: 'Khóa tài khoản' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
  ).toBeDisabled();
  expect(
    screen.getByText(
      /Không thể khóa hoặc đặt lại mật khẩu tài khoản đang đăng nhập/,
    ),
  ).toBeVisible();
});

it('requires confirmation before locking an account', async () => {
  const fetcher = vi.fn();
  vi.stubGlobal('fetch', fetcher);
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  render(
    <UserDetailPanel user={account} audit={[]} currentAdminId="admin-id" />,
  );
  await userEvent.click(screen.getByRole('button', { name: 'Khóa tài khoản' }));
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
  await userEvent.click(
    screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(/kết nối/);
  expect(
    screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
  ).toBeEnabled();
});

it('reports denied history requests without displaying an empty successful result', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { error: { message: 'Bạn không có quyền thực hiện thao tác này.' } },
          { status: 403 },
        ),
      ),
  );
  render(
    <UserDetailPanel user={account} audit={[]} currentAdminId="admin-id" />,
  );
  await userEvent.click(screen.getByRole('button', { name: /Tải lịch sử/ }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Bạn không có quyền',
  );
  expect(screen.queryByText('Chưa có kết quả thi.')).not.toBeInTheDocument();
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
  await userEvent.click(
    screen.getByRole('button', { name: 'Đặt lại mật khẩu' }),
  );
  expect(screen.getByRole('button', { name: 'Khóa tài khoản' })).toBeDisabled();
  finish(Response.json({ user: { ...account, status: 'pending_password' } }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Khóa tài khoản' }),
    ).toBeEnabled(),
  );
});
