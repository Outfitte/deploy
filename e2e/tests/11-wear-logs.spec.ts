import { test, expect } from '../fixtures';
import { todayFormatted } from '../helpers';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

const ITEM_NAME = 'WearLog-E2E-Item';

async function navigateToItem(page: Page) {
  await page.goto('/items');
  await expect(page.getByRole('link', { name: `View ${ITEM_NAME}` })).toBeVisible();
  await page.getByRole('link', { name: `View ${ITEM_NAME}` }).click();
  await expect(page.getByTestId('item-detail-page')).toBeVisible();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('wear log — setup', () => {
  test('create item for wear log tests', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });
});

// ─── Validation (error cases first) ──────────────────────────────────────────

test.describe('wear log — validation', () => {
  test('log wear with future date shows error and does not create entry', async ({ page }) => {
    await navigateToItem(page);

    await page.getByRole('button', { name: 'Log wear' }).click();

    await page.getByLabel('Date').fill('2099-01-01');
    await page.getByRole('button', { name: 'Save' }).click();

    // Error message scoped to the wear log form to avoid false positives
    await expect(
      page.locator('[data-testid="item-detail-page"] form').locator('text=/future/i')
    ).toBeVisible();
    await expect(page.getByTestId('wear-count')).toHaveText('0');
  });
});

// ─── Happy path + edge cases (sequential, state accumulates) ─────────────────
// Pre-condition: 0 wear entries on WearLog-E2E-Item (setup and validation left it at 0).

test.describe('wear log — happy path', () => {
  test('"Wore today" quick action on item card shows success toast', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await card.getByRole('button', { name: 'Wore today' }).click();

    await expect(page.getByText('Wear logged')).toBeVisible();
  });

  test('item detail shows one wear entry with today\'s date', async ({ page }) => {
    await navigateToItem(page);

    await expect(page.getByTestId('wear-count')).toHaveText('1');

    const entries = page.locator('[data-testid="item-detail-page"] ul li');
    await expect(entries).toHaveCount(1);
    await expect(entries.first()).toContainText(todayFormatted());
  });

  test('log a second wear with a past date and notes', async ({ page }) => {
    await navigateToItem(page);

    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill('2024-06-15');
    await page.getByLabel('Notes').fill('Conference outfit');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.locator('[data-testid="item-detail-page"] form')).not.toBeVisible();
    await expect(page.getByTestId('wear-count')).toHaveText('2');
  });

  test('wear history shows two entries ordered by date descending', async ({ page }) => {
    await navigateToItem(page);

    const entries = page.locator('[data-testid="item-detail-page"] ul li');
    await expect(entries).toHaveCount(2);

    // Today's entry is more recent and should appear first; 2024 entry should appear second
    await expect(entries.first()).toContainText(todayFormatted());
    await expect(entries.nth(1)).toContainText('Jun 15, 2024');
    await expect(entries.nth(1)).toContainText('Conference outfit');
  });

  test('delete the most recent wear log → history shows one entry', async ({ page }) => {
    await navigateToItem(page);

    const entries = page.locator('[data-testid="item-detail-page"] ul li');
    await expect(entries).toHaveCount(2);

    await entries.first().getByRole('button', { name: 'Delete wear log' }).click();

    await expect(entries).toHaveCount(1);
    await expect(page.getByTestId('wear-count')).toHaveText('1');
  });

  test('delete the last wear log → wear count is zero', async ({ page }) => {
    await navigateToItem(page);

    const entries = page.locator('[data-testid="item-detail-page"] ul li');
    await expect(entries).toHaveCount(1);

    await entries.first().getByRole('button', { name: 'Delete wear log' }).click();

    await expect(entries).toHaveCount(0);
    await expect(page.getByTestId('wear-count')).toHaveText('0');
  });

  // ── Edge cases (pre-condition: 0 entries, left by the delete tests above) ──

  test('log two wears on the same date with different notes — both appear in history', async ({ page }) => {
    await navigateToItem(page);

    for (const notes of ['Morning run', 'Evening event']) {
      await page.getByRole('button', { name: 'Log wear' }).click();
      await page.getByLabel('Date').fill('2024-03-10');
      await page.getByLabel('Notes').fill(notes);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('[data-testid="item-detail-page"] form')).not.toBeVisible();
    }

    const entries = page.locator('[data-testid="item-detail-page"] ul li');
    await expect(entries).toHaveCount(2);
    await expect(page.locator('[data-testid="item-detail-page"] ul')).toContainText('Morning run');
    await expect(page.locator('[data-testid="item-detail-page"] ul')).toContainText('Evening event');
  });

  test('wear count updates correctly after create and delete', async ({ page }) => {
    // 2 entries left by "log two wears on the same date" test above
    await navigateToItem(page);

    const entries = page.locator('[data-testid="item-detail-page"] ul li');
    await expect(page.getByTestId('wear-count')).toHaveText('2');

    await entries.first().getByRole('button', { name: 'Delete wear log' }).click();
    await expect(entries).toHaveCount(1);
    await entries.first().getByRole('button', { name: 'Delete wear log' }).click();
    await expect(entries).toHaveCount(0);
    await expect(page.getByTestId('wear-count')).toHaveText('0');

    // Add one back and verify the count reflects it
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill('2024-05-01');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="item-detail-page"] form')).not.toBeVisible();

    await expect(page.getByTestId('wear-count')).toHaveText('1');
  });
});
