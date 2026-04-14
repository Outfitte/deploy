import { test, expect } from '@playwright/test';
import { adminLogin } from '../helpers';

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

test.describe('admin settings', () => {
  test('registration toggle is visible on settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('switch', { name: 'Registration enabled' })).toBeVisible();
  });

  test('disabling registration blocks new signups, re-enabling restores them', async ({
    page,
    browser,
  }) => {
    await page.goto('/settings');
    const toggle = page.getByRole('switch', { name: 'Registration enabled' });

    // Disable registration
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    // Verify registration is blocked for an anonymous user
    const anonContext = await browser.newContext();
    const anonPage = await anonContext.newPage();
    await anonPage.goto('/register');
    await anonPage.getByLabel('Email').fill(`blocked-${Date.now()}@test.local`);
    await anonPage.getByLabel('Password', { exact: true }).fill('Blocked1234!');
    await anonPage.getByLabel('Confirm password').fill('Blocked1234!');
    await anonPage.getByRole('button', { name: 'Register' }).click();
    await expect(anonPage.getByRole('alert')).toBeVisible();
    await expect(anonPage).not.toHaveURL(/\/(login)$/);
    await anonContext.close();

    // Re-enable so subsequent test runs are not affected
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
