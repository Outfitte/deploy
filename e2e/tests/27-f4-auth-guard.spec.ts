import { test, expect } from '../fixtures';
import { registerUser } from '../helpers';

test.describe('unauthenticated access to F4 routes', () => {
  test('unauthenticated visit to /transfers redirects to /login', async ({ page }) => {
    await page.goto('/transfers');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /transfers?tab=outgoing redirects to /login', async ({ page }) => {
    await page.goto('/transfers?tab=outgoing');
    // The guard builds the return URL from the pathname only, so the redirect
    // preserves /transfers in `next` while dropping the ?tab=outgoing query.
    await expect(page).toHaveURL(/\/login\?next=%2Ftransfers/);
  });
});

test.describe('return URL after login (F4 routes)', () => {
  let email: string;
  let password: string;

  test.beforeAll(async ({ browser }) => {
    ({ email, password } = await registerUser(browser));
  });

  test('login redirects back to originally requested F4 page', async ({ page }) => {
    await page.goto('/transfers');
    await expect(page).toHaveURL(/\/login/);

    // Fill the form on the current page (which carries the return URL) rather
    // than navigating to /login fresh — that would drop the redirect parameter.
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/transfers/);
  });
});
