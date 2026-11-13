// @vitest-environment jsdom
import React from 'react';
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { SettingsPanel } from './settings-panel';
const initial = {
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
it('only enables saving changed settings and supports reverting edits', async () => {
  render(<SettingsPanel initialSettings={initial} />);
  expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeDisabled();
  await userEvent.type(
    screen.getByLabelText('Tên hệ thống / Tiêu đề kỳ thi'),
    ' updated',
  );
  expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeEnabled();
  await userEvent.click(screen.getByRole('button', { name: 'Hủy thay đổi' }));
  expect(screen.getByLabelText('Tên hệ thống / Tiêu đề kỳ thi')).toHaveValue(
    'CCA',
  );
  expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeDisabled();
});
it('keeps edits available after a network error and shows a clear retry message', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
  );
  render(<SettingsPanel initialSettings={initial} />);
  await userEvent.type(
    screen.getByLabelText('Tên hệ thống / Tiêu đề kỳ thi'),
    ' updated',
  );
  await userEvent.click(screen.getByRole('button', { name: 'Lưu cài đặt' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/kết nối/);
  expect(screen.getByLabelText('Tên hệ thống / Tiêu đề kỳ thi')).toHaveValue(
    'CCA updated',
  );
  expect(screen.getByRole('button', { name: 'Lưu cài đặt' })).toBeEnabled();
});
