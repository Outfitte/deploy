import { test, expect } from '@playwright/test';

test('register new user and stay authenticated on reload', async ({ page }) => {
  const email = `user-${Date.now()}@test.local`;
  const password = 'User1234!';

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();

  await expect(page).not.toHaveURL(/\/(login|register)/);

  await page.reload();
  await expect(page).not.toHaveURL(/\/(login|register)/);
});
