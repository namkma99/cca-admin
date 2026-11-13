// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { UsersPanel } from './users-panel';
import { UserDetailPanel } from './user-detail-panel';

const student = {
  id: 'student-id',
  username: 'alice',
  role: 'student',
  status: 'active',
  firstLoginAt: null,
  lastLoginAt: null,
  createdAt: '2026-11-13T00:00:00Z',
};
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('filters users by status and distinguishes empty search results', async () => {
  const user = userEvent.setup();
  render(<UsersPanel initialUsers={[student]} />);
  await user.selectOptions(screen.getByLabelText('Status'), 'disabled');
  expect(screen.queryByRole('link', { name: 'alice' })).not.toBeInTheDocument();
  expect(screen.getByText('No users found')).toBeVisible();
});

it('recovers from a failed creation without losing the username', async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Network unavailable')),
  );
  render(<UsersPanel />);
  await user.type(screen.getByLabelText('Username'), 'alice');
  await user.click(screen.getByRole('button', { name: 'Create student' }));
  expect(await screen.findByRole('alert')).toBeVisible();
  expect(screen.getByLabelText('Username')).toHaveValue('alice');
  expect(screen.getByRole('button', { name: 'Create student' })).toBeEnabled();
});

it('renders exam history as a table and keeps a failed refresh visible', async () => {
  const user = userEvent.setup();
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          results: [
            {
              id: 'attempt',
              topicId: 'cca-f',
              formNumber: 2,
              status: 'submitted',
              startedAt: 1794528000000,
              endedAt: 1794531600000,
              finalizedAt: 1794531600000,
              total: 60,
              correct: 45,
              wrong: 10,
              unanswered: 5,
              simulatedScore: 750,
              percent: 75,
              reason: 'submitted',
              cycleId: 'cycle',
            },
          ],
        }),
      )
      .mockRejectedValueOnce(new Error('Network unavailable')),
  );
  render(<UserDetailPanel user={student} audit={[]} currentAdminId="admin" />);
  await user.click(screen.getByRole('button', { name: 'Load history' }));
  expect(await screen.findByRole('cell', { name: '75%' })).toBeVisible();
  expect(screen.getByRole('cell', { name: 'CCA-F' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Refresh history' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
  expect(screen.getByRole('cell', { name: '75%' })).toBeVisible();
});
