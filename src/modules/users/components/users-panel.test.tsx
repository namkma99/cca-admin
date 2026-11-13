// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { UsersPanel } from './users-panel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('catches failed account creation and lets the admin retry', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  render(<UsersPanel />);
  await userEvent.type(screen.getByLabelText('Username'), 'alice');
  await userEvent.click(screen.getByRole('button', { name: 'Tạo học viên' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/kết nối/);
  expect(screen.getByRole('button', { name: 'Tạo học viên' })).toBeEnabled();
  expect(screen.getByLabelText('Username')).toHaveValue('alice');
});

it('filters by role and status without mixing up admin and student permissions', async () => {
  render(
    <UsersPanel
      initialUsers={[
        {
          id: '1',
          username: 'alice',
          role: 'student',
          status: 'pending_password',
          firstLoginAt: null,
          lastLoginAt: null,
          createdAt: '2026-11-12T12:00:00Z',
        },
        {
          id: '2',
          username: 'root',
          role: 'admin',
          status: 'active',
          firstLoginAt: null,
          lastLoginAt: null,
          createdAt: '2026-11-12T12:00:00Z',
        },
      ]}
    />,
  );
  await userEvent.selectOptions(
    screen.getByLabelText('Lọc vai trò'),
    'student',
  );
  expect(screen.getByRole('link', { name: 'alice' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'root' })).not.toBeInTheDocument();
  await userEvent.selectOptions(
    screen.getByLabelText('Lọc trạng thái'),
    'disabled',
  );
  expect(screen.getByText('Không tìm thấy tài khoản phù hợp.')).toBeVisible();
});
