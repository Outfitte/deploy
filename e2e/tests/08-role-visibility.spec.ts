import { test, expect } from '@playwright/test';
import { adminLogin, registerUser, loginAs } from '../helpers';

test.describe('role-based settings visibility', () => {
  test('admin sees the registration toggle', async ({ page }) => {
    await adminLogin(page);
    await page.goto('/settings');
    await expect(page.getByRole('switch', { name: 'Registration enabled' })).toBeVisible();
  });

  test('member user does not see the registration toggle', async ({ page, browser }) => {
    const { email, password } = await registerUser(browser);
    await loginAs(page, email, password);
    await page.goto('/settings');
    await expect(page.getByRole('switch', { name: 'Registration enabled' })).not.toBeVisible();
  });
});
