import { test, expect, type Page } from '@playwright/test';
const api = 'http://127.0.0.1:4321';
const headers = { Origin: 'http://127.0.0.1:4175' };

test.beforeEach(async ({ request }) => {
  const response = await request.post(`${api}/__test/reset`, {
    headers: { 'x-fixture-key': 'local-test-only' },
  });
  expect(response.ok()).toBeTruthy();
});
async function activate(page: Page) {
  await page.goto('/cca');
  await expect(
    page.getByRole('heading', { name: 'Đăng nhập phòng thi' }),
  ).toBeVisible();
  await page.getByLabel('Username').fill('student');
  await page
    .getByLabel('Mật khẩu', { exact: true })
    .fill('fixture-password-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Đặt mật khẩu của bạn' }),
  ).toBeVisible();
  await page.getByLabel('Mật khẩu mới').fill('permanent-fixture-password-123');
  await page
    .getByLabel('Xác nhận mật khẩu')
    .fill('permanent-fixture-password-123');
  await page.getByRole('button', { name: 'Đặt mật khẩu', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '10 đề · CCA-F' }),
  ).toBeVisible();
}
test('cookie auth, activation, exam submit, summary-only storage and persistent login', async ({
  page,
  context,
}) => {
  await activate(page);
  const cookies = await context.cookies(api);
  const cookie = cookies.find((c) => c.name === 'cca_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Lax');
  expect(cookie!.expires - Date.now() / 1000).toBeGreaterThan(23 * 3600);
  await page
    .getByRole('button', { name: 'Bắt đầu đề 01', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Câu 1 / 60', exact: true }),
  ).toBeVisible();
  await page.locator('fieldset input').first().check();
  await expect(page.getByText('Đã lưu đáp án', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nộp bài', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Xác nhận/ })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Kết quả bài thi' }),
  ).toBeVisible();
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
    cookie: document.cookie,
  }));
  expect(storage.cookie).not.toContain('cca_session');
  expect(storage.local['devpro:cca:results']).toBeTruthy();
  const result = JSON.parse(storage.local['devpro:cca:results']!);
  expect(result).toHaveLength(1);
  expect(JSON.stringify(storage)).not.toMatch(
    /permanent-fixture|fixture-password|correctChoiceIds|question_snapshot|Synthetic option/,
  );
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '10 đề · CCA-F' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Bắt đầu đề 01', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Đăng nhập phòng thi' }),
  ).toBeVisible();
  expect(
    (await context.cookies(api)).some((c) => c.name === 'cca_session'),
  ).toBe(false);
});

test('confirmed reload consumes attempt while keeping login, admin reset preserves history', async ({
  page,
  request,
}) => {
  await activate(page);
  await page
    .getByRole('button', { name: 'Bắt đầu đề 01', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Câu 1 / 60', exact: true }),
  ).toBeVisible();
  await page.locator('fieldset input').first().check();
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await expect(
    page.getByRole('heading', { name: '10 đề · CCA-F' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Bắt đầu đề 01', exact: true }),
  ).toHaveCount(0);
  const admin = await request.post(`${api}/api/v1/auth/login`, {
    headers,
    data: { username: 'admin', password: 'fixture-password-123' },
  });
  expect(admin.ok()).toBeTruthy();
  const listing = await request.get(`${api}/api/v1/admin/users`, { headers });
  const user = (await listing.json()).users.find(
    (entry: { username: string }) => entry.username === 'student',
  );
  const reset = await request.post(
    `${api}/api/v1/admin/users/${user.id}/reset-cycle`,
    { headers, data: { topicId: 'cca-f' } },
  );
  expect(reset.ok()).toBeTruthy();
  await page.getByRole('button', { name: 'Tải lại danh sách đề' }).click();
  await expect(
    page.getByRole('button', { name: 'Bắt đầu đề 01', exact: true }),
  ).toBeEnabled();
});

test('mobile multiple choice and server deadline finalization', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await activate(page);
  await page.getByRole('button', { name: 'Chọn CCAR-P', exact: true }).click();
  await page
    .getByRole('button', { name: 'Bắt đầu đề 01', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Câu 1 / 63', exact: true }),
  ).toBeVisible();
  await request.post(`${api}/__test/advance`, {
    headers: { 'x-fixture-key': 'local-test-only' },
    data: { milliseconds: 120 * 60 * 1000 + 1000 },
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('heading', { name: 'Kết quả bài thi' }),
  ).toBeVisible();
  await expect(page.getByText('Hết thời gian', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
