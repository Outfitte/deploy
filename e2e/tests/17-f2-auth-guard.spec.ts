import { test, expect } from '@playwright/test';
import { registerUser } from '../helpers';

const FAKE_ITEM_ID = '00000000-0000-0000-0000-000000000001';

test.describe('unauthenticated access to F2 routes', () => {
  test('unauthenticated visit to /items redirects to /login', async ({ page }) => {
    await page.goto('/items');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /items/new redirects to /login', async ({ page }) => {
    await page.goto('/items/new');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /items/:id redirects to /login', async ({ page }) => {
    await page.goto(`/items/${FAKE_ITEM_ID}`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /items/:id/edit redirects to /login', async ({ page }) => {
    await page.goto(`/items/${FAKE_ITEM_ID}/edit`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /locations redirects to /login', async ({ page }) => {
    await page.goto('/locations');
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('return URL after login', () => {
  let email: string;
  let password: string;

  test.beforeAll(async ({ browser }) => {
    ({ email, password } = await registerUser(browser));
  });

  test('login redirects back to originally requested page', async ({ page }) => {
    await page.goto('/items');
    await expect(page).toHaveURL(/\/login/);

    // Fill the form on the current page (which carries the return URL) rather
    // than navigating to /login fresh — that would drop the redirect parameter.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/items/);
  });
});
