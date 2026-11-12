import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'cca-cookie.spec.ts',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    channel: 'chrome',
    trace: 'retain-on-failure',
    contextOptions: { reducedMotion: 'reduce' },
  },
  webServer: [
    {
      command:
        'node --conditions=react-server --import tsx tests/helpers/cca-api-server.ts',
      url: 'http://127.0.0.1:4321/api/v1/auth/session',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'PORT=4175 node ../next-pro/scripts/serve-out.mjs',
      url: 'http://127.0.0.1:4175/cca',
      reuseExistingServer: false,
      timeout: 60000,
    },
  ],
});
