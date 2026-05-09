import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

const ITEM_NAME = 'Archive-E2E-Item';
const EDGE_ITEM_NAME = 'Archive-Edge-Item';

async function navigateToItem(page: Page, name: string = ITEM_NAME) {
  await page.goto('/items');
  await page.getByRole('button', { name: 'All' }).click();
  await expect(page.getByTestId('item-card').filter({ hasText: name })).toBeVisible();
  await page.getByRole('link', { name: `View ${name}` }).click();
  await expect(page.getByTestId('item-detail-page')).toBeVisible();
}

async function switchStatusFilter(page: Page, status: 'Active' | 'Archived' | 'All') {
  await page.getByRole('button', { name: status }).click();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('archive lifecycle — setup', () => {
  test('create items for archive tests', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(EDGE_ITEM_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });
});

// ─── Validation (error cases first) ──────────────────────────────────────────

test.describe('archive lifecycle — validation', () => {
  test('active item detail shows Archive button, not Unarchive', async ({ page }) => {
    await navigateToItem(page);

    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unarchive' })).not.toBeVisible();
  });

  test('archived item context menu shows Unarchive, not Archive', async ({ page }) => {
    // First archive the item
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await card.getByRole('button', { name: 'Item options' }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(page.getByText('Item archived')).toBeVisible();

    // Navigate fresh to the archived filter to avoid React Query refetch race
    await page.goto('/items?status=archived');
    const archivedCard = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await expect(archivedCard).toBeVisible();
    await archivedCard.getByRole('button', { name: 'Item options' }).click();

    await expect(page.getByRole('menuitem', { name: 'Unarchive' })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: 'Archive', exact: true })).not.toBeVisible();

    // Press Escape to close the menu without acting
    await page.keyboard.press('Escape');
  });
});

// ─── Happy path (sequential, state accumulates) ───────────────────────────────
// Pre-condition: ITEM_NAME is archived (left by validation tests above).

test.describe('archive lifecycle — happy path', () => {
  test('archived filter shows the archived item', async ({ page }) => {
    await page.goto('/items');
    await switchStatusFilter(page, 'Archived');

    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await expect(card).toBeVisible();
  });

  test('all filter shows archived item with archived indicator', async ({ page }) => {
    await page.goto('/items');
    await switchStatusFilter(page, 'All');

    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await expect(card).toBeVisible();
    // Expect some visual archived indicator (badge, label, etc.)
    await expect(card.getByText(/archived/i)).toBeVisible();
  });

  test('item detail shows archived state and Unarchive button on fresh page load', async ({ page }) => {
    await navigateToItem(page);

    await expect(page.getByRole('button', { name: 'Unarchive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).not.toBeVisible();
  });

  test('unarchive via context menu in archived list', async ({ page }) => {
    await page.goto('/items');
    await switchStatusFilter(page, 'Archived');

    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await card.getByRole('button', { name: 'Item options' }).click();
    await page.getByRole('menuitem', { name: 'Unarchive' }).click();
    await expect(page.getByText('Item unarchived')).toBeVisible();

    // Item should disappear from archived list
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_NAME })).not.toBeVisible();
  });

  test('unarchived item reappears in active list with Archive button', async ({ page }) => {
    await page.goto('/items');
    // Default active filter
    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await expect(card).toBeVisible();

    // Verify detail page shows Archive (not Unarchive) — item is active
    await page.getByRole('link', { name: `View ${ITEM_NAME}` }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Unarchive' })).not.toBeVisible();
  });

  test('archive from detail page — Unarchive button appears in same session', async ({ page }) => {
    await navigateToItem(page);

    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Item archived')).toBeVisible();

    // In-session state update: Archive button swaps to Unarchive
    await expect(page.getByRole('button', { name: 'Unarchive' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Archive', exact: true })).not.toBeVisible();
  });

  test('dispose archived item from detail page with reason donated', async ({ page }) => {
    await navigateToItem(page);

    await page.getByRole('button', { name: 'Dispose' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: `Dispose of ${ITEM_NAME}` })).toBeVisible();

    // Reason 'donated' is the default; confirm it is selected and submit
    await expect(page.locator('#dispose-reason')).toHaveValue('donated');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Item disposed')).toBeVisible();
  });

  test('disposed item visible in archived filter', async ({ page }) => {
    // Dispose marks archived_at, so it appears in the archived filter
    await page.goto('/items');
    await switchStatusFilter(page, 'Archived');

    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await expect(card).toBeVisible();
  });

  test('disposed item shows disposal reason in archived filter', async ({ page }) => {
    await page.goto('/items');
    await switchStatusFilter(page, 'Archived');

    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    await expect(card).toBeVisible();
    await expect(card.getByText(/donated/i)).toBeVisible();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test.describe('archive lifecycle — edge cases', () => {
  test('dispose active item without prior archive — item becomes archived and disposed', async ({ page }) => {
    // Navigate to the edge-case item which is still active
    await navigateToItem(page, EDGE_ITEM_NAME);

    await page.getByRole('button', { name: 'Dispose' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.locator('#dispose-reason').selectOption('sold');
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Item disposed')).toBeVisible();

    // Item must now be visible in the archived filter (dispose auto-archives)
    await page.goto('/items');
    await switchStatusFilter(page, 'Archived');
    await expect(page.getByTestId('item-card').filter({ hasText: EDGE_ITEM_NAME })).toBeVisible();
  });

  test('all disposal reason options are present in the dispose dialog', async ({ page }) => {
    // Use the edge item (disposed); any item detail will do since Dispose button is always shown.
    // Navigate to items, pick any available item.
    await page.goto('/items');
    await switchStatusFilter(page, 'All');

    // Use ITEM_NAME which is disposed/archived
    await page.getByRole('link', { name: `View ${ITEM_NAME}` }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    await page.getByRole('button', { name: 'Dispose' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const select = page.locator('#dispose-reason');
    await expect(select.locator('option[value="donated"]')).toBeAttached();
    await expect(select.locator('option[value="sold"]')).toBeAttached();
    await expect(select.locator('option[value="discarded"]')).toBeAttached();
    await expect(select.locator('option[value="lost"]')).toBeAttached();
    await expect(select.locator('option[value="other"]')).toBeAttached();

    // Cancel without disposing
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
