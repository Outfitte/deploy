import { test, expect } from '../fixtures';
import { loginAs } from '../helpers';

test.describe('registration form validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('empty form submission shows required-field errors', async ({ page }) => {
    await page.getByRole('button', { name: 'Register' }).click();
    // All three fields are required; at least one validation message must appear
    const errors = page.locator('[role="alert"], .text-destructive, [aria-invalid="true"]');
    await expect(errors.first()).toBeVisible();
  });

  test('mismatched passwords shows inline error', async ({ page }) => {
    await page.getByLabel('Email').fill(`mismatch-${Date.now()}@test.local`);
    await page.getByLabel('Password', { exact: true }).fill('Match1234!');
    await page.getByLabel('Confirm password').fill('Different1234!');
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText('Passwords do not match')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });
});

test.describe('registration server errors', () => {
  test('duplicate email shows conflict error', async ({ page, adminCredentials }) => {
    const { email } = adminCredentials;

    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('Duplicate1234!');
    await page.getByLabel('Confirm password').fill('Duplicate1234!');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('registration disabled shows descriptive error', async ({ page, browser, adminCredentials }) => {
    // Disable registration as admin, attempt to register as anon, re-enable
    const { email: adminEmail, password: adminPassword } = adminCredentials;
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await loginAs(adminPage, adminEmail, adminPassword);
    await adminPage.goto('/settings');
    const toggle = adminPage.getByRole('switch', { name: 'Registration enabled' });
    if ((await toggle.getAttribute('aria-checked')) === 'true') {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-checked', 'false');
    }

    // Attempt registration as anonymous user
    await page.goto('/register');
    await page.getByLabel('Email').fill(`disabled-${Date.now()}@test.local`);
    await page.getByLabel('Password', { exact: true }).fill('Disabled1234!');
    await page.getByLabel('Confirm password').fill('Disabled1234!');
    await page.getByRole('button', { name: 'Register' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/disabled/i);
    await expect(page).toHaveURL(/\/register/);

    // Re-enable so subsequent tests are not affected
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await adminContext.close();
  });
});
