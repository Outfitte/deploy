import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const adminCredsFile = path.join(__dirname, '../.auth/admin-creds.json');

setup('register admin and enable registration', async ({ page }) => {
  const email = `admin-${Date.now()}@test.local`;
  const password = 'Admin1234!';

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm password').fill(password);
  await page.getByRole('button', { name: 'Register' }).click();
  await expect(page).not.toHaveURL(/\/(login|register)/);

  // Backend disables registration after the first user — enable it so other tests can register
  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Registration enabled' });
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute('aria-checked')) === 'false') {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  }

  fs.writeFileSync(adminCredsFile, JSON.stringify({ email, password }));
});
