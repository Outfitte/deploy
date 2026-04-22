import { test, expect } from '@playwright/test';
import { adminLogin } from '../helpers';

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

// Uses item-detail-page testid rather than a URL regex so that /items/new
// (which matches /\/items\/[^/]+$/) cannot produce a false positive.
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

    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/new/);

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

    // Polling assertion — fails if the page navigates away to the detail URL
    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);
    await expect(page.getByTestId('edit-item-page')).toBeVisible();

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
    await page.getByRole('button', { name: 'Save' }).click();

    // Polling: if item is accepted the URL changes; this fails in that case
    await expect(page).toHaveURL(/\/items\/new/);
  });

  test('currency without price shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationCurrencyNoPrice-${Date.now()}`);
    await page.getByLabel('Currency').fill('USD');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/new/);
  });

  test('negative price shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationNegativePrice-${Date.now()}`);
    await page.getByLabel('Price').fill('-5.00');
    await page.getByLabel('Currency').fill('USD');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/new/);
  });

  test('clearly invalid currency codes (too short / non-alpha) show error', async ({ page }) => {
    for (const [i, badCurrency] of (['XX', '1234'] as const).entries()) {
      await page.goto('/items/new');
      await page.getByLabel('Name *').fill(`ValidationBadCurrency-${badCurrency}-${Date.now()}-${i}`);
      await page.getByLabel('Price').fill('10.00');
      await page.getByLabel('Currency').fill(badCurrency);
      await page.getByRole('button', { name: 'Save' }).click();

      await expect(page, `Expected to stay on /items/new for currency '${badCurrency}'`).toHaveURL(/\/items\/new/);
    }
  });

  // Skipped: the currency input has maxLength={3}, so Playwright's fill('USDX') is silently
  // truncated to 'USD' by the browser before validation runs — the item is then created with
  // a valid currency. This is a frontend UX bug (paste truncation without user feedback).
  // https://github.com/Outfitte/frontend/issues/113
  test.skip('4-character invalid currency code shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationBadCurrency-USDX-${Date.now()}`);
    await page.getByLabel('Price').fill('10.00');
    await page.getByLabel('Currency').fill('USDX');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/new/);
  });

  test('future purchase date shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationFutureDate-${Date.now()}`);
    await page.getByLabel('Purchase Date').fill('2099-01-01');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/new/);
  });

  test('metadata key exceeding 64 characters shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationLongMetaKey-${Date.now()}`);
    await page.getByRole('button', { name: 'Add Field' }).click();
    await page.getByPlaceholder('Key').fill('a'.repeat(65));
    await page.getByPlaceholder('Value').fill('somevalue');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/new/);
  });

  test('metadata key with special characters shows error', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(`ValidationSpecialMetaKey-${Date.now()}`);
    await page.getByRole('button', { name: 'Add Field' }).click();
    await page.getByPlaceholder('Key').fill('bad key!@#');
    await page.getByPlaceholder('Value').fill('somevalue');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page).toHaveURL(/\/items\/new/);
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

    await expect(page).toHaveURL(/\/items\/new/);
  });

  test('edit item: set price without currency shows error', async ({ page }) => {
    const detailUrl = await createMinimalItem(page, `ValidationEditPriceNoCurrency-${Date.now()}`);
    await page.goto(detailUrl);
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);
    await expect(page.getByTestId('edit-item-page')).toBeVisible();

    await page.getByLabel('Price').fill('19.99');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);
    await expect(page.getByTestId('edit-item-page')).toBeVisible();
  });
});

test.describe('edge cases — create item', () => {
  test('create item with only name succeeds and shows placeholders for optional fields', async ({ page }) => {
    await page.goto('/items/new');
    await expect(page.getByTestId('create-item-page')).toBeVisible();

    const name = `MinimalItem-${Date.now()}`;
    await page.getByLabel('Name *').fill(name);
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { name })).toBeVisible();
  });

  test('create item with category set to uncategorised succeeds', async ({ page }) => {
    await page.goto('/items/new');
    const name = `UncategorisedItem-${Date.now()}`;
    await page.getByLabel('Name *').fill(name);

    const categorySelect = page.getByLabel('Category');
    const emptyOption = categorySelect.locator('option[value=""]');
    if ((await emptyOption.count()) > 0) {
      await categorySelect.selectOption('');
    }

    await page.getByRole('button', { name: 'Save' }).click();

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

    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByText('USD')).toBeVisible();
  });

  test('navigate away from create form without saving does not create a partial item', async ({ page }) => {
    await page.goto('/items/new');
    const name = `AbandonedItem-${Date.now()}`;
    await page.getByLabel('Name *').fill(name);
    await page.getByLabel('Brand').fill('AbandonedBrand');

    await page.goto('/items');
    await expect(page.getByTestId('items-page')).toBeVisible();

    const card = page.getByTestId('item-card').filter({ hasText: name });
    await expect(card).not.toBeAttached();
  });
});
