import { Browser, Page, expect } from '@playwright/test';

// Returns 'Apr 22, 2026' style — matches date-fns format(date, 'MMM d, yyyy') used by the UI.
// Uses UTC so the result matches what the backend stores regardless of the runner's local timezone.
export function todayFormatted(): string {
  const d = new Date();
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

// Returns today's date in 'yyyy-MM-dd' format (UTC) for filling date inputs.
export function todayInputValue(): string {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export async function registerUser(browser: Browser): Promise<{ email: string; password: string }> {
  const email = `user-${Date.now()}@test.local`;
  const password = 'User1234!';
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

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'User menu' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function switchUser(page: Page, email: string, password: string) {
  await logout(page);
  await loginAs(page, email, password);
}
