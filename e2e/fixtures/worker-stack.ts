import path from 'path';
import { test as base, type Browser } from '@playwright/test';
import { execSync } from 'child_process';
import { loginAs } from '../helpers';

const DEPLOY_DIR = path.resolve(__dirname, '../..');
const RECIPIENT_EMAIL = 'recipient@example.com';
const RECIPIENT_PASSWORD = 'recipient-password-123';

type WorkerStack = {
  port: number;
  adminEmail: string;
  adminPassword: string;
  memberEmail: string;
  memberPassword: string;
  recipientEmail: string;
  recipientPassword: string;
};

type WorkerFixtures = {
  workerStack: WorkerStack;
};

type TestFixtures = {
  // Overrides built-in baseURL (test-scoped) so each test's page uses this worker's URL.
  baseURL: string;
  adminLogin: () => Promise<void>;
  adminCredentials: { email: string; password: string };
  memberCredentials: { email: string; password: string };
};

async function waitForHealth(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Stack health check timed out: ${url}`);
}

async function runAdminSetup(
  browser: Browser,
  port: number,
  workerIndex: number,
): Promise<{ adminEmail: string; adminPassword: string; memberEmail: string; memberPassword: string }> {
  const baseURL = `http://localhost:${port}`;
  const adminEmail = `admin-w${workerIndex}-${Date.now()}@test.local`;
  const adminPassword = 'Admin1234!';
  const memberEmail = `member-w${workerIndex}-${Date.now()}@test.local`;
  const memberPassword = 'Member1234!';

  // Register first user (becomes admin automatically)
  const adminCtx = await browser.newContext({ baseURL });
  const adminPage = await adminCtx.newPage();
  await adminPage.goto('/register');
  await adminPage.getByLabel('Email').fill(adminEmail);
  await adminPage.getByLabel('Password', { exact: true }).fill(adminPassword);
  await adminPage.getByLabel('Confirm password').fill(adminPassword);
  await adminPage.getByRole('button', { name: 'Register' }).click();
  await adminPage.waitForURL((url) => !url.toString().includes('/register'));

  // Backend disables registration after first user — re-enable it
  await adminPage.goto('/settings');
  const toggle = adminPage.getByRole('switch', { name: 'Registration enabled' });
  if ((await toggle.getAttribute('aria-checked')) === 'false') {
    await toggle.click();
  }
  await adminCtx.close();

  // Register member in an isolated context
  const memberCtx = await browser.newContext({ baseURL });
  const memberPage = await memberCtx.newPage();
  await memberPage.goto('/register');
  await memberPage.getByLabel('Email').fill(memberEmail);
  await memberPage.getByLabel('Password', { exact: true }).fill(memberPassword);
  await memberPage.getByLabel('Confirm password').fill(memberPassword);
  await memberPage.getByRole('button', { name: 'Register' }).click();
  await memberPage.waitForURL((url) => !url.toString().includes('/register'));
  await memberCtx.close();

  // Register recipient in an isolated context
  const recipientCtx = await browser.newContext({ baseURL });
  const recipientPage = await recipientCtx.newPage();
  await recipientPage.goto('/register');
  await recipientPage.getByLabel('Email').fill(RECIPIENT_EMAIL);
  await recipientPage.getByLabel('Password', { exact: true }).fill(RECIPIENT_PASSWORD);
  await recipientPage.getByLabel('Confirm password').fill(RECIPIENT_PASSWORD);
  await recipientPage.getByRole('button', { name: 'Register' }).click();
  await recipientPage.waitForURL((url) => !url.toString().includes('/register'));
  await recipientCtx.close();

  return { adminEmail, adminPassword, memberEmail, memberPassword };
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  workerStack: [
    async ({ browser }, use, workerInfo) => {
      const port = 40080 + workerInfo.workerIndex;
      const project = `outfitte-w${workerInfo.workerIndex}`;

      execSync(`PORT=${port} docker compose -p ${project} up -d`, {
        cwd: DEPLOY_DIR,
        timeout: 120_000,
        stdio: 'pipe',
      });

      await waitForHealth(`http://localhost:${port}/health`);

      const { adminEmail, adminPassword, memberEmail, memberPassword } = await runAdminSetup(
        browser,
        port,
        workerInfo.workerIndex,
      );

      await use({
        port,
        adminEmail,
        adminPassword,
        memberEmail,
        memberPassword,
        recipientEmail: RECIPIENT_EMAIL,
        recipientPassword: RECIPIENT_PASSWORD,
      });

      execSync(`docker compose -p ${project} down -v`, {
        cwd: DEPLOY_DIR,
        stdio: 'pipe',
      });
    },
    { scope: 'worker' },
  ],

  baseURL: async ({ workerStack }, use) => {
    await use(`http://localhost:${workerStack.port}`);
  },

  adminLogin: async ({ page, workerStack }, use) => {
    const { adminEmail, adminPassword } = workerStack;
    await use(() => loginAs(page, adminEmail, adminPassword));
  },

  adminCredentials: async ({ workerStack }, use) => {
    await use({ email: workerStack.adminEmail, password: workerStack.adminPassword });
  },

  memberCredentials: async ({ workerStack }, use) => {
    await use({ email: workerStack.memberEmail, password: workerStack.memberPassword });
  },
});

export { expect } from '@playwright/test';
