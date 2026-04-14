import { test, expect, Browser } from '@playwright/test';

async function registerUser(browser: Browser): Promise<{ email: string; password: string }> {
  const email = `auth-${Date.now()}@test.local`;
  const password = 'Auth1234!';
  const page = await browser.newPage();
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await page.waitForURL((url) => !url.toString().includes('/register'));
  await page.close();
  return { email, password };
}

test.describe('authentication flow', () => {
  let email: string;
  let password: string;

  test.beforeAll(async ({ browser }) => {
    ({ email, password } = await registerUser(browser));
  });

  test('logout redirects to /login', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/(login|register)/);

    await page.getByRole('button', { name: 'User menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login redirects to authenticated home', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/(login|register)/);
  });
});
