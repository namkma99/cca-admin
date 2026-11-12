// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthForm } from './auth-form';

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('auth forms', () => {
  it('submits normalized username, never persists credentials and navigates to setup', async () => {
    const user = userEvent.setup();
    const localWrite = vi.fn();
    const sessionWrite = vi.fn();
    vi.stubGlobal('localStorage', { setItem: localWrite });
    vi.stubGlobal('sessionStorage', { setItem: sessionWrite });
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        session: {
          kind: 'password_setup',
          expiresAt: '2026-11-13T12:00:00.000Z',
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            username: 'admin',
            role: 'admin',
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText('Username'), ' Admin ');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/setup-password'),
    );
    const [, init] = fetcher.mock.calls[0]!;
    expect(JSON.parse(init.body)).toEqual({
      username: 'admin',
    });
    expect(init.credentials).toBe('include');
    expect(localWrite).not.toHaveBeenCalled();
    expect(sessionWrite).not.toHaveBeenCalled();
  });

  it('identifies active user and requires password in step 2', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          needPassword: true,
          username: 'admin',
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          session: {
            kind: 'authenticated',
            expiresAt: '2026-11-13T12:00:00.000Z',
            user: {
              id: '00000000-0000-4000-8000-000000000001',
              username: 'admin',
              role: 'admin',
            },
          },
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(await screen.findByLabelText('Mật khẩu')).toBeVisible();
    await user.type(screen.getByLabelText('Mật khẩu'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Hiện mật khẩu' }));
    expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: 'Đăng nhập' }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/admin'));
  });

  it('shows generic server errors and re-enables submit after failure', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: {
              code: 'INVALID_CREDENTIALS',
              message: 'Username hoặc mật khẩu không chính xác.',
            },
          },
          { status: 401 },
        ),
      ),
    );
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Username hoặc mật khẩu không chính xác.',
    );
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled();
  });

  it('prevents mismatched setup passwords from reaching the API', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    render(<AuthForm mode="setup" />);
    await user.type(
      screen.getByLabelText('Mật khẩu mới'),
      'permanent-password-123',
    );
    await user.type(
      screen.getByLabelText('Xác nhận mật khẩu'),
      'different-password-123',
    );
    await user.click(screen.getByRole('button', { name: 'Đặt mật khẩu' }));
    expect(
      await screen.findByText('Xác nhận mật khẩu chưa khớp.'),
    ).toBeVisible();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('sends both setup fields and navigates to the appropriate authenticated destination', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn().mockResolvedValue(
      Response.json({
        session: {
          kind: 'authenticated',
          expiresAt: '2026-11-13T12:00:00.000Z',
          user: {
            id: '00000000-0000-4000-8000-000000000001',
            username: 'student',
            role: 'student',
          },
        },
      }),
    );
    vi.stubGlobal('fetch', fetcher);
    render(<AuthForm mode="setup" />);
    await user.type(
      screen.getByLabelText('Mật khẩu mới'),
      'permanent-password-123',
    );
    await user.type(
      screen.getByLabelText('Xác nhận mật khẩu'),
      'permanent-password-123',
    );
    await user.click(screen.getByRole('button', { name: 'Đặt mật khẩu' }));
    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith('/account'),
    );
    expect(JSON.parse(fetcher.mock.calls[0]![1].body)).toEqual({
      password: 'permanent-password-123',
      confirmPassword: 'permanent-password-123',
    });
  });
  it('disables submit while a request is pending and recovers after network failure', async () => {
    const user = userEvent.setup();
    let fail!: (error: Error) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((_resolve, reject) => {
            fail = reject;
          }),
      ),
    );
    render(<AuthForm mode="login" />);
    await user.type(screen.getByLabelText('Username'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Tiếp tục' }));
    expect(
      await screen.findByRole('button', { name: 'Đang kiểm tra…' }),
    ).toBeDisabled();
    fail(new Error('Network unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Network unavailable',
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeEnabled(),
    );
    expect(router.replace).not.toHaveBeenCalled();
  });
});
