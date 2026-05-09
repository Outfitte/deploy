import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

const ITEM_A = 'Filter-E2E-Item-A';
const ITEM_B = 'Filter-E2E-Item-B';
const ITEM_C = 'Filter-E2E-Item-C';
const LOCATION_NAME = 'Filter-E2E-Bedroom';

async function getCardIndex(page: Page, name: string): Promise<number> {
  await page.getByTestId('item-card').filter({ hasText: name }).waitFor({ state: 'visible' });
  return page.getByTestId('item-card').evaluateAll(
    (cards, n) => cards.findIndex((c) => c.textContent?.includes(n)),
    name
  );
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('filters — setup', () => {
  test('create Filter-E2E-Bedroom location', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('button', { name: 'Create location' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.locator('#create-label').fill(LOCATION_NAME);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await expect(page.locator('[data-testid^="tree-node-"]').filter({ hasText: LOCATION_NAME })).toBeVisible();
  });

  test('create Item A: Tops category, Bedroom location', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_A);
    await page.getByLabel('Category').selectOption({ label: 'Tops' });
    // Root-level location has no em-dash prefix, so plain label matching is safe here.
    await page.getByLabel('Location').selectOption({ label: LOCATION_NAME });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });

  test('create Item B: Footwear category, no location', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_B);
    await page.getByLabel('Category').selectOption({ label: 'Footwear' });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });

  test('create Item C: Tops category, Bedroom location, then archive', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_C);
    await page.getByLabel('Category').selectOption({ label: 'Tops' });
    // Root-level location has no em-dash prefix, so plain label matching is safe here.
    await page.getByLabel('Location').selectOption({ label: LOCATION_NAME });
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Archive' }).click();
    await expect(page.getByText('Item archived')).toBeVisible();
  });
});

// ─── Edge cases (before happy-path per project convention) ───────────────────

test.describe('filters — edge cases', () => {
  test('no-match filter shows a "no items match" message, not the empty-state CTA', async ({ page }) => {
    await page.goto('/items');
    // Footwear + Bedroom location → no active items match (B has no location)
    await page.getByLabel('Category').selectOption({ label: 'Footwear' });
    // Root-level location has no em-dash prefix, so plain label matching is safe here.
    await page.getByLabel('Location').selectOption({ label: LOCATION_NAME });
    await expect(page.getByText('No items yet')).not.toBeVisible();
    await expect(page.getByText(/no items match/i)).toBeVisible();
  });
});

// ─── Status filter ────────────────────────────────────────────────────────────

test.describe('filters — status', () => {
  test('default active filter shows A and B, excludes archived C', async ({ page }) => {
    await page.goto('/items');
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).not.toBeVisible();
  });

  test('archived filter shows C, excludes A and B', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('button', { name: 'Archived' }).click();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).not.toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).not.toBeVisible();
  });

  test('all filter shows A, B, and C', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).toBeVisible();
  });
});

// ─── Category filter ──────────────────────────────────────────────────────────

test.describe('filters — category', () => {
  test('Tops category + active status shows A, excludes B and C', async ({ page }) => {
    await page.goto('/items');
    await page.getByLabel('Category').selectOption({ label: 'Tops' });
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).not.toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).not.toBeVisible();
  });

  test('Tops category + status all shows A and C, excludes B', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('button', { name: 'All' }).click();
    await page.getByLabel('Category').selectOption({ label: 'Tops' });
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).not.toBeVisible();
  });

  test('Footwear category shows only B among filter items', async ({ page }) => {
    await page.goto('/items');
    await page.getByLabel('Category').selectOption({ label: 'Footwear' });
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).not.toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).not.toBeVisible();
  });
});

// ─── Location filter ──────────────────────────────────────────────────────────

test.describe('filters — location', () => {
  test('Bedroom location filter shows A, excludes B (no location) and C (archived)', async ({ page }) => {
    await page.goto('/items');
    // Use exact: true so Playwright doesn't substring-match item cards whose aria-label contains "Location".
    await page.getByLabel('Location', { exact: true }).selectOption({ label: LOCATION_NAME });
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).not.toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).not.toBeVisible();
  });
});

// ─── Sort ─────────────────────────────────────────────────────────────────────

test.describe('filters — sort', () => {
  test('newest sort: Item B (created second) appears before Item A', async ({ page }) => {
    await page.goto('/items');
    const idxA = await getCardIndex(page, ITEM_A);
    const idxB = await getCardIndex(page, ITEM_B);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeLessThan(idxA);
  });

  test('name sort: Item A appears before Item B', async ({ page }) => {
    await page.goto('/items');
    await page.getByLabel('Sort').selectOption('name');
    const idxA = await getCardIndex(page, ITEM_A);
    const idxB = await getCardIndex(page, ITEM_B);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeLessThan(idxB);
  });

  test('oldest sort: Item A (created first) appears before Item B', async ({ page }) => {
    await page.goto('/items');
    await page.getByLabel('Sort').selectOption('oldest');
    const idxA = await getCardIndex(page, ITEM_A);
    const idxB = await getCardIndex(page, ITEM_B);
    expect(idxA).toBeGreaterThanOrEqual(0);
    expect(idxB).toBeGreaterThanOrEqual(0);
    expect(idxA).toBeLessThan(idxB);
  });
});

// ─── URL persistence ──────────────────────────────────────────────────────────

test.describe('filters — URL persistence', () => {
  test('reload with ?status=archived shows C and excludes A and B', async ({ page }) => {
    await page.goto('/items?status=archived');
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).not.toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).not.toBeVisible();
  });

  test('navigating to item detail and back preserves filters', async ({ page }) => {
    await page.goto('/items?status=all');
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).toBeVisible();
    await page.getByRole('link', { name: `View ${ITEM_C}` }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.goBack();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
  });
});

// ─── Clear filters ────────────────────────────────────────────────────────────

test.describe('filters — clear', () => {
  test('resetting all filters shows A and B, excludes C', async ({ page }) => {
    await page.goto('/items?status=all');
    await page.getByLabel('Category').selectOption({ label: 'Tops' });
    await page.getByLabel('Sort').selectOption('name');

    await page.getByRole('button', { name: 'Active' }).click();
    await page.getByLabel('Category').selectOption('');
    await page.getByLabel('Sort').selectOption('newest');

    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).toBeVisible();
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).not.toBeVisible();
  });
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

test.describe('filters — teardown', () => {
  test('delete active items A and B', async ({ page }) => {
    await page.goto('/items');
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_A })).toBeVisible();
    await page.getByRole('link', { name: `View ${ITEM_A}` }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/items$/);

    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_B })).toBeVisible();
    await page.getByRole('link', { name: `View ${ITEM_B}` }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/items$/);
  });

  test('delete archived item C', async ({ page }) => {
    await page.goto('/items?status=archived');
    await expect(page.getByTestId('item-card').filter({ hasText: ITEM_C })).toBeVisible();
    await page.getByRole('link', { name: `View ${ITEM_C}` }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/items$/);
  });

  test('delete Filter-E2E-Bedroom location', async ({ page }) => {
    await page.goto('/locations');
    const node = page.locator('[data-testid^="tree-node-"]').filter({ hasText: LOCATION_NAME });
    await node.hover();
    await node.getByRole('button', { name: 'More options' }).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Location deleted').first()).toBeVisible();
  });
});
