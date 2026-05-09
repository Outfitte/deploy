import { test, expect } from '../fixtures';

test('unauthenticated access to / redirects to /login', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated access to /settings redirects to /login', async ({ page }) => {
  await page.goto('/settings');
  await expect(page).toHaveURL(/\/login/);
});
