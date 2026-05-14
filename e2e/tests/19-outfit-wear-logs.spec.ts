import { test, expect } from '../fixtures';
import { todayFormatted, todayInputValue } from '../helpers';
import type { Page } from '@playwright/test';

const OUTFIT_NAME = 'OutfitWearLog-E2E';
const OUTFIT_ZERO = 'OutfitWearLog-E2E-Zero';
const ITEM_1 = 'OutfitWearLog-E2E-Item-1';
const ITEM_2 = 'OutfitWearLog-E2E-Item-2';

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

async function navigateToOutfit(page: Page, name: string) {
  await page.goto('/outfits');
  await page.getByRole('link', { name: 'View ' + name, exact: true }).click();
  await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
}

// Returns only wear log list items (not the item grid links, which have no Delete button)
function wearLogEntries(page: Page) {
  return page
    .locator('[data-testid="outfit-detail-page"] li')
    .filter({ has: page.locator('button[aria-label="Delete wear log"]') });
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('outfit wear log — setup', () => {
  test('create items, main outfit with 2 items, and zero-item outfit', async ({ page }) => {
    for (const name of [ITEM_1, ITEM_2]) {
      await page.goto('/items/new');
      await page.getByLabel('Name *').fill(name);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(/\/items\/[^/]+$/);
    }

    await page.goto('/outfits/new');
    await page.getByLabel('Name').fill(OUTFIT_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);

    for (const itemName of [ITEM_1, ITEM_2]) {
      await page.getByRole('button', { name: 'Add item' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.getByPlaceholder('Search items…').fill(itemName);
      await expect(dialog.getByText(itemName)).toBeVisible();
      await dialog.getByRole('button', { name: 'Add' }).click();
      await expect(dialog).not.toBeVisible();
      await expect(
        page.locator('li').filter({ hasText: itemName }).getByRole('button', { name: 'Remove' }),
      ).toBeVisible();
    }

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);

    await page.goto('/outfits/new');
    await page.getByLabel('Name').fill(OUTFIT_ZERO);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);
  });
});

// ─── Validation (error cases first) ──────────────────────────────────────────

test.describe('outfit wear log — validation', () => {
  test('future date shows error and log not created', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill('2099-01-01');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.locator('[data-testid="outfit-detail-page"] form').locator('text=/future/i'),
    ).toBeVisible();
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('0');
  });

  test('notes optional — date-only submit creates log', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill('2024-01-15');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('1');
    // Clean up to leave OUTFIT_NAME at 0 logs for the happy path
    const entries = wearLogEntries(page);
    await entries.first().getByRole('button', { name: 'Delete wear log' }).click();
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('0');
  });
});

// ─── Happy path (sequential, state accumulates) ──────────────────────────────
// Pre-condition: OUTFIT_NAME has 0 wear logs (left by setup + validation)
// mode: 'serial' prevents CI retries from running mid-chain tests in isolation

test.describe('outfit wear log — happy path', () => {
  test.describe.configure({ mode: 'serial' });

  test("Log wear button opens form with today's date defaulted", async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    await page.getByRole('button', { name: 'Log wear' }).click();
    await expect(page.getByLabel('Date')).toHaveValue(todayInputValue());
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();
    // State: 0 logs
  });

  test('submit with notes → entry in history, count and last-worn update', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Notes').fill('First wear of the season');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('1');
    await expect(page.getByTestId('outfit-last-worn')).toContainText(todayFormatted());
    const entries = wearLogEntries(page);
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText(todayFormatted());
    await expect(entries.first()).toContainText('First wear of the season');
    // State: 1 log (today)
  });

  test('per-item wear logs created via outfit→item linkage (M4)', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    for (const itemName of [ITEM_1, ITEM_2]) {
      await page.getByRole('link').filter({ hasText: itemName }).click();
      await expect(page.getByTestId('item-detail-page')).toBeVisible();
      await expect(page.getByTestId('wear-count')).toHaveText('1');
      const itemEntries = page.locator('[data-testid="item-detail-page"] ul li');
      await expect(itemEntries).toHaveCount(1);
      await expect(itemEntries.first()).toContainText(todayFormatted());
      await page.goBack();
      await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    }
  });

  test('log a second wear with a custom past date', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill('2024-06-20');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('2');
    // State: 2 logs (today + Jun 20, 2024)
  });

  test('wear history shows two entries sorted by date descending', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    const entries = wearLogEntries(page);
    await expect(entries).toHaveCount(2);
    await expect(entries.first()).toContainText(todayFormatted());
    await expect(entries.nth(1)).toContainText('Jun 20, 2024');
  });

  test('delete first outfit log → second log still visible', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    const entries = wearLogEntries(page);
    await expect(entries).toHaveCount(2);
    await entries.first().getByRole('button', { name: 'Delete wear log' }).click();
    await expect(entries).toHaveCount(1);
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('1');
    await expect(entries.first()).toContainText('Jun 20, 2024');
  });

  test('delete last outfit log → count 0, history empty', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    const entries = wearLogEntries(page);
    await expect(entries).toHaveCount(1);
    await entries.first().getByRole('button', { name: 'Delete wear log' }).click();
    await expect(entries).toHaveCount(0);
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('0');
    // State: 0 logs
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test.describe('outfit wear log — edge cases', () => {
  test('outfit with zero items: log wear creates outfit log, no per-item logs', async ({ page }) => {
    await navigateToOutfit(page, OUTFIT_ZERO);
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();
    await expect(page.getByTestId('outfit-wear-count')).toHaveText('1');

    // Verify no per-item wear logs were created for items that don't belong to this outfit
    for (const itemName of [ITEM_1, ITEM_2]) {
      await page.goto('/items');
      await page.getByRole('link', { name: 'View ' + itemName, exact: true }).click();
      await expect(page.getByTestId('item-detail-page')).toBeVisible();
      await expect(page.getByTestId('wear-count')).toHaveText('0');
    }
  });

  test('two outfit wears on same date with different notes both appear in history', async ({
    page,
  }) => {
    await navigateToOutfit(page, OUTFIT_NAME);
    for (const notes of ['Morning event', 'Evening party']) {
      await page.getByRole('button', { name: 'Log wear' }).click();
      await page.getByLabel('Date').fill('2024-03-15');
      await page.getByLabel('Notes').fill(notes);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('[data-testid="outfit-detail-page"] form')).not.toBeVisible();
    }
    const entries = wearLogEntries(page);
    await expect(entries).toHaveCount(2);
    await expect(page.locator('[data-testid="outfit-detail-page"]')).toContainText('Morning event');
    await expect(page.locator('[data-testid="outfit-detail-page"]')).toContainText('Evening party');
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

test.describe('outfit wear log — cleanup', () => {
  test('delete test outfits and items', async ({ page }) => {
    for (const name of [OUTFIT_NAME, OUTFIT_ZERO]) {
      await page.goto('/outfits');
      const card = page.getByTestId('outfit-card').filter({ hasText: name });
      if ((await card.count()) === 0) continue;
      await page.getByRole('link', { name: 'View ' + name, exact: true }).click();
      await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/outfits$/);
    }

    for (const name of [ITEM_1, ITEM_2]) {
      await page.goto('/items');
      const card = page.getByTestId('item-card').filter({ hasText: name });
      if ((await card.count()) === 0) continue;
      await page.getByRole('link', { name: 'View ' + name, exact: true }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/items$/);
    }
  });
});
