import { test, expect } from '@playwright/test';
import { adminLogin } from '../helpers';

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

test('dark mode toggle persists across reload', async ({ page }) => {
  await page.goto('/');

  const html = page.locator('html');

  // Normalise to light mode first so the test is idempotent
  if (await html.evaluate((el) => el.classList.contains('dark'))) {
    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(html).not.toHaveClass(/\bdark\b/);
  }

  // Switch to dark
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(html).toHaveClass(/\bdark\b/);

  // Reload — preference must survive
  await page.reload();
  await expect(html).toHaveClass(/\bdark\b/);
});
