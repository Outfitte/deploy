import { test, expect } from '../fixtures';
import { registerUser } from '../helpers';

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
