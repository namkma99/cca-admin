// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsPanel } from './settings-panel';
import { appSettingsSchema } from '../contracts/schemas';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('edits auth policy, submits it with credentials and displays the saved values', async () => {
  const user = userEvent.setup();
  const initial = appSettingsSchema.parse({});
  const fetcher = vi.fn(async (_url: string, init: RequestInit) =>
    Response.json({ settings: JSON.parse(init.body as string) }),
  );
  vi.stubGlobal('fetch', fetcher);
  render(<SettingsPanel initialSettings={initial} />);
  const lifetime = screen.getByLabelText('Thời hạn phiên đăng nhập (phút)');
  expect(lifetime).toHaveValue(1440);
  await user.clear(lifetime);
  await user.type(lifetime, '60');
  const attempts = screen.getByLabelText('Số lần đăng nhập tối đa / tài khoản');
  await user.clear(attempts);
  await user.type(attempts, '3');
  await user.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Đã lưu'),
  );
  const [url, init] = fetcher.mock.calls[0]!;
  expect(url).toBe('/api/v1/admin/settings');
  expect(init.credentials).toBe('include');
  expect(JSON.parse(init.body as string).auth).toEqual({
    sessionDurationMinutes: 60,
    passwordSetupDurationMinutes: 10,
    loginRateLimit: {
      windowMinutes: 15,
      maxAttemptsPerUsername: 3,
      maxAttemptsPerIp: 50,
    },
  });
});
