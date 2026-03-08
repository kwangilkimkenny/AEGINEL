import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.e2e.ts',
  timeout: 60000,
  retries: 0,
  workers: 1, // Extension tests require a single persistent context
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    headless: false,
    actionTimeout: 15000,
  },
  expect: {
    timeout: 10000,
  },
});
