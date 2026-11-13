// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsPanel } from './settings-panel';
const settings = {
  examDurationMinutes: 120,
  formCount: 10,
  passingScorePercentage: 70,
  systemName: 'CCA',
  allowReviewAnswers: true,
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('tracks unsaved edits, restores saved values and clears dirty state after saving', async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ settings: { ...settings, systemName: 'New CCA' } }),
      ),
  );
  render(<SettingsPanel initialSettings={settings} />);
  expect(screen.getByRole('button', { name: 'Save settings' })).toBeDisabled();
  await user.clear(screen.getByLabelText('System name'));
  await user.type(screen.getByLabelText('System name'), 'Draft');
  expect(screen.getByText('You have unsaved changes.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Discard changes' }));
  expect(screen.getByLabelText('System name')).toHaveValue('CCA');
  await user.clear(screen.getByLabelText('System name'));
  await user.type(screen.getByLabelText('System name'), 'New CCA');
  await user.click(screen.getByRole('button', { name: 'Save settings' }));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save settings' }),
    ).toBeDisabled(),
  );
  expect(
    screen.queryByText('You have unsaved changes.'),
  ).not.toBeInTheDocument();
});
