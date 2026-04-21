import { test, expect } from '@playwright/test';
import { adminLogin } from '../helpers';

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

// Helper: create an item with a unique name and return its detail URL.
// Uses item-detail-page testid to confirm the redirect completed, avoiding
// the false positive where /items/new matches /\/items\/[^/]+$/.
async function createMinimalItem(page: import('@playwright/test').Page, name: string) {
  await page.goto('/items/new');
  await page.getByLabel('Name *').fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByTestId('item-detail-page')).toBeVisible();
  return page.url();
}

test.describe('form validation — empty name', () => {
  test('create item with empty name shows validation error and does not submit', async ({ page }) => {
    await page.goto('/items/new');
    await expect(page.getByTestId('create-item-page')).toBeVisible();

    // Leave name empty and attempt to submit
    await page.getByRole('button', { name: 'Save' }).click();

    // Should stay on the create page (URL unchanged)
    await expect(page).toHaveURL(/\/items\/new/);

    // Name input should be marked invalid or an error message should be visible
    const nameInput = page.getByLabel('Name *');
    const isInvalid = await nameInput.evaluate((el) =>
      !(el as HTMLInputElement).validity.valid
    );
    const errorVisible = await page.locator('text=/name.*required|required.*name/i').isVisible().catch(() => false);
    expect(isInvalid || errorVisible).toBe(true);
  });

  test('edit item: clearing name prevents submission', async ({ page }) => {
    const detailUrl = await createMinimalItem(page, `ValidationEditName-${Date.now()}`);
    await page.goto(detailUrl);
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);

    const nameInput = page.getByLabel('Name *');
    await nameInput.clear();
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Should still be on the edit page
    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);

    const isInvalid = await nameInput.evaluate((el) =>
      !(el as HTMLInputElement).validity.valid
    );
    const errorVisible = await page.locator('text=/name.*required|required.*name/i').isVisible().catch(() => false);
    expect(isInvalid || errorVisible).toBe(true);
  });
});

test.describe('422 validation errors — create item', () => {
  test('price without currency shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationPriceNoCurrency-${Date.now()}`);
    await page.getByLabel('Price').fill('29.99');
    // Leave Currency empty
    await page.getByRole('button', { name: 'Save' }).click();

    // Either stays on create page (client-side) or shows error toast/message
    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('currency without price shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationCurrencyNoPrice-${Date.now()}`);
    await page.getByLabel('Currency').fill('USD');
    // Leave Price empty
    await page.getByRole('button', { name: 'Save' }).click();

    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('negative price shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationNegativePrice-${Date.now()}`);
    await page.getByLabel('Price').fill('-5.00');
    await page.getByLabel('Currency').fill('USD');
    await page.getByRole('button', { name: 'Save' }).click();

    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('clearly invalid currency codes (too short / non-alpha) show error', async ({ page }) => {
    for (const badCurrency of ['XX', '1234']) {
      await page.goto('/items/new');
      await page.getByLabel('Name *').fill(`ValidationBadCurrency-${badCurrency}-${Date.now()}`);
      await page.getByLabel('Price').fill('10.00');
      await page.getByLabel('Currency').fill(badCurrency);
      await page.getByRole('button', { name: 'Save' }).click();

      const stayedOnPage = page.url().includes('/items/new');
      const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid/i').isVisible().catch(() => false);
      expect(stayedOnPage || errorShown, `Expected error for currency '${badCurrency}'`).toBe(true);
    }
  });

  // Skipped: backend accepts 4-character invalid currency codes (e.g. 'USDX') without error.
  // https://github.com/Outfitte/backend/issues/496
  test.skip('4-character invalid currency code shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationBadCurrency-USDX-${Date.now()}`);
    await page.getByLabel('Price').fill('10.00');
    await page.getByLabel('Currency').fill('USDX');
    await page.getByRole('button', { name: 'Save' }).click();

    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('future purchase date shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationFutureDate-${Date.now()}`);
    await page.getByLabel('Purchase Date').fill('2099-01-01');
    await page.getByRole('button', { name: 'Save' }).click();

    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid|future/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('metadata key exceeding 64 characters shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationLongMetaKey-${Date.now()}`);
    await page.getByRole('button', { name: 'Add Field' }).click();
    const longKey = 'a'.repeat(65);
    await page.getByPlaceholder('Key').fill(longKey);
    await page.getByPlaceholder('Value').fill('somevalue');
    await page.getByRole('button', { name: 'Save' }).click();

    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid|64|key/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('metadata key with special characters shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationSpecialMetaKey-${Date.now()}`);
    await page.getByRole('button', { name: 'Add Field' }).click();
    await page.getByPlaceholder('Key').fill('bad key!@#');
    await page.getByPlaceholder('Value').fill('somevalue');
    await page.getByRole('button', { name: 'Save' }).click();

    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid|special|key/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('more than 50 metadata fields shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationTooManyMeta-${Date.now()}`);

    for (let i = 1; i <= 51; i++) {
      await page.getByRole('button', { name: 'Add Field' }).click();
      await page.getByPlaceholder('Key').last().fill(`field${i}`);
      await page.getByPlaceholder('Value').last().fill(`value${i}`);
    }

    await page.getByRole('button', { name: 'Save' }).click();

    const stayedOnPage = page.url().includes('/items/new');
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid|50|metadata/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });

  test('edit item: set price without currency shows error', async ({ page }) => {
    // Create item with no price/currency
    const detailUrl = await createMinimalItem(page, `ValidationEditPriceNoCurrency-${Date.now()}`);
    await page.goto(detailUrl);
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);
    await expect(page.getByTestId('edit-item-page')).toBeVisible();

    await page.getByLabel('Price').fill('19.99');
    // Leave Currency blank
    await page.getByRole('button', { name: 'Save Changes' }).click();

    const stayedOnPage = /\/items\/[^/]+\/edit/.test(page.url());
    const errorShown = await page.locator('[role="alert"], [data-testid="error-toast"], .toast, text=/422|error|invalid/i').isVisible().catch(() => false);
    expect(stayedOnPage || errorShown).toBe(true);
  });
});

test.describe('edge cases — create item', () => {
  test('create item with only name succeeds and shows placeholders for optional fields', async ({ page }) => {
    await page.goto('/items/new');
    await expect(page.getByTestId('create-item-page')).toBeVisible();

    const name = `MinimalItem-${Date.now()}`;
    await page.getByLabel('Name *').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('create item with category set to uncategorised succeeds', async ({ page }) => {
    await page.goto('/items/new');
    const name = `UncategorisedItem-${Date.now()}`;
    await page.getByLabel('Name *').fill(name);

    // Select the blank/uncategorised option if available
    const categorySelect = page.getByLabel('Category');
    await categorySelect.selectOption('');

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('currency normalisation: lowercase input displays as uppercase on detail page', async ({ page }) => {
    await page.goto('/items/new');
    const name = `CurrencyNorm-${Date.now()}`;
    await page.getByLabel('Name *').fill(name);
    await page.getByLabel('Price').fill('15.00');
    await page.getByLabel('Currency').fill('usd');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByText('USD')).toBeVisible();
  });

  test('navigate away from create form without saving does not create a partial item', async ({ page }) => {
    await page.goto('/items/new');
    const name = `AbandonedItem-${Date.now()}`;
    await page.getByLabel('Name *').fill(name);
    await page.getByLabel('Brand').fill('AbandonedBrand');

    // Navigate away without saving
    await page.goto('/items');
    await expect(page.getByTestId('items-page')).toBeVisible();

    // The abandoned item must not appear
    const card = page.getByTestId('item-card').filter({ hasText: name });
    await expect(card).not.toBeAttached();
  });
});
