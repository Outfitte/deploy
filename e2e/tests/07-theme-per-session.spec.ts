import { test, expect } from '../fixtures';
import { loginAs, logout } from '../helpers';

test('each user keeps their own theme preference across logout and login', async ({ browser, adminCredentials, memberCredentials }) => {
  const { email: adminEmail, password: adminPassword } = adminCredentials;
  const { email: memberEmail, password: memberPassword } = memberCredentials;

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
