import { test, expect } from '../fixtures';
import { registerUser } from '../helpers';

const FAKE_UUID = '00000000-0000-0000-0000-000000000001';

test.describe('unauthenticated access to F3 routes', () => {
  test('unauthenticated visit to /outfits redirects to /login', async ({ page }) => {
    await page.goto('/outfits');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /outfits/new redirects to /login', async ({ page }) => {
    await page.goto('/outfits/new');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /outfits/:id redirects to /login', async ({ page }) => {
    await page.goto(`/outfits/${FAKE_UUID}`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /outfits/:id/edit redirects to /login', async ({ page }) => {
    await page.goto(`/outfits/${FAKE_UUID}/edit`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /calendar redirects to /login', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /shares redirects to /login', async ({ page }) => {
    await page.goto('/shares');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /shared redirects to /login', async ({ page }) => {
    await page.goto('/shared');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /shared/items/:id redirects to /login', async ({ page }) => {
    await page.goto(`/shared/items/${FAKE_UUID}`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /shared/outfits/:id redirects to /login', async ({ page }) => {
    await page.goto(`/shared/outfits/${FAKE_UUID}`);
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /shared/locations/:id redirects to /login', async ({ page }) => {
    await page.goto(`/shared/locations/${FAKE_UUID}`);
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('return URL after login (F3 routes)', () => {
  let email: string;
  let password: string;

  test.beforeAll(async ({ browser }) => {
    ({ email, password } = await registerUser(browser));
  });

  test('login redirects back to originally requested F3 page', async ({ page }) => {
    await page.goto('/outfits');
    await expect(page).toHaveURL(/\/login/);

    // Fill the form on the current page (which carries the return URL) rather
    // than navigating to /login fresh — that would drop the redirect parameter.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/outfits/);
  });
});
