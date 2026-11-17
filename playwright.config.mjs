import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 0,
  forbidOnly: true,
  reporter: 'list',
  outputDir: '.visual-runs/browser-results',
  use: {
    baseURL: 'http://127.0.0.1:3200',
    viewport: { width: 1512, height: 982 },
    // Ordinary workflow journeys exercise a returning visitor. The guide suite
    // explicitly starts with empty storage to observe first-arrival behavior.
    storageState: { cookies: [], origins: [{ origin: 'http://127.0.0.1:3200', localStorage: [{ name: 'sot:guide:v1', value: 'seen' }] }] },
    launchOptions: process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {},
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `"${process.execPath}" scripts/serve.mjs`,
    env: { PORT: '3200', NODE_ENV: 'production' },
    url: 'http://127.0.0.1:3200',
    reuseExistingServer: false,
    timeout: 15_000,
  },
});
