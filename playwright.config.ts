import { defineConfig, devices } from '@playwright/test';

const BASE_URL = `http://localhost:${process.env.PORT ?? 30080}`;

export default defineConfig({
  testDir: './e2e/tests',
  fullyParallel: false,
  // Specs accumulate shared admin data across files; 1 worker keeps execution sequential.
  // CI is naturally 1 worker (2-CPU runner); set explicitly here so local runs match.
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['github'], ['html', { open: 'never' }]]
    : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testMatch: /admin\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'recipient-setup',
      testMatch: /recipient\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'e2e',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup', 'recipient-setup'],
    },
  ],
  webServer: {
    command: 'docker compose up',
    url: `${BASE_URL}/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  globalTeardown: './e2e/global-teardown.ts',
});
