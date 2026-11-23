import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests against a running stack: `docker compose up --build` (http://localhost:4300),
 * or the dev setup (`npm start` + backend). Override the address with E2E_BASE_URL.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4300',
    locale: 'tr-TR',
    timezoneId: 'Europe/Istanbul',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        // Locally use the installed Chrome; CI installs Playwright's Chromium.
        channel: process.env['CI'] ? undefined : 'chrome',
      },
    },
  ],
});
