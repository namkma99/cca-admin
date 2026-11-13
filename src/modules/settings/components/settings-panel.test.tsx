// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsPanel } from './settings-panel';
import { appSettingsSchema } from '../contracts/schemas';
const initial = appSettingsSchema.parse({
  examDurationMinutes: 120,
  formCount: 10,
  passingScorePercentage: 70,
  systemName: 'CCA',
  allowReviewAnswers: true,
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('only enables saving changed settings and supports reverting edits', async () => {
  render(<SettingsPanel initialSettings={initial} />);
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await userEvent.type(screen.getByLabelText('System name'), ' updated');
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled();
  await userEvent.click(
    screen.getByRole('button', { name: 'Discard changes' }),
  );
  expect(screen.getByLabelText('System name')).toHaveValue('CCA');
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
});
it('keeps edits available after a network error and shows a clear retry message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  render(<SettingsPanel initialSettings={initial} />);
  await userEvent.type(screen.getByLabelText('System name'), ' updated');
  await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/connect/);
  expect(screen.getByLabelText('System name')).toHaveValue('CCA updated');
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeEnabled();
});

it('edits auth policy, submits it with credentials and displays the saved values', async () => {
  const user = userEvent.setup();
  const initial = appSettingsSchema.parse({});
  const fetcher = vi.fn(async (_url: string, init: RequestInit) =>
    Response.json({ settings: JSON.parse(init.body as string) }),
  );
  vi.stubGlobal('fetch', fetcher);
  render(<SettingsPanel initialSettings={initial} />);
  const lifetime = screen.getByLabelText('Session duration (minutes)');
  expect(lifetime).toHaveValue(1440);
  await user.clear(lifetime);
  await user.type(lifetime, '60');
  const attempts = screen.getByLabelText(
    'Maximum sign-in attempts per account',
  );
  await user.clear(attempts);
  await user.type(attempts, '3');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('Settings saved'),
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
