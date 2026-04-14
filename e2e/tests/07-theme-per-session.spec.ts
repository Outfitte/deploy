import { test, expect } from '@playwright/test';
import fs from 'fs';
import { adminCredsFile, memberCredsFile, loginAs, logout } from '../helpers';

/**
 * Theme is stored in localStorage (per browser context, not per user account).
 * Two users in separate browser contexts maintain independent theme preferences.
 * Logging out and back in must not reset the stored theme.
 *
 * Uses pre-registered admin + member accounts from admin.setup.ts to avoid
 * racing with tests that temporarily disable registration.
 */
test('each user keeps their own theme preference across logout and login', async ({ browser }) => {
  const { email: adminEmail, password: adminPassword } = JSON.parse(
    fs.readFileSync(adminCredsFile, 'utf-8'),
  );
  const { email: memberEmail, password: memberPassword } = JSON.parse(
    fs.readFileSync(memberCredsFile, 'utf-8'),
  );

  const adminContext = await browser.newContext();
  const memberContext = await browser.newContext();
  const adminPage = await adminContext.newPage();
  const memberPage = await memberContext.newPage();

  try {
    // --- Set admin to dark mode ---
    await loginAs(adminPage, adminEmail, adminPassword);
    await adminPage.goto('/settings');
    await adminPage.getByRole('button', { name: 'dark', exact: true }).click();
    await expect(adminPage.locator('html')).toHaveClass(/\bdark\b/);
    await logout(adminPage);

    // --- Set member to light mode ---
    await loginAs(memberPage, memberEmail, memberPassword);
    await memberPage.goto('/settings');
    await memberPage.getByRole('button', { name: 'light', exact: true }).click();
    await expect(memberPage.locator('html')).not.toHaveClass(/\bdark\b/);
    await logout(memberPage);

    // --- Admin logs back in: dark mode must persist ---
    await loginAs(adminPage, adminEmail, adminPassword);
    await expect(adminPage.locator('html')).toHaveClass(/\bdark\b/);

    // --- Member logs back in: light mode must persist ---
    await loginAs(memberPage, memberEmail, memberPassword);
    await expect(memberPage.locator('html')).not.toHaveClass(/\bdark\b/);
  } finally {
    await adminContext.close();
    await memberContext.close();
  }
});
