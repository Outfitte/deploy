import { test, expect } from '@playwright/test';
import { registerUser, loginAs } from '../helpers';

const ITEM_1 = 'Dashboard-Stat-Item-1';
const ITEM_2 = 'Dashboard-Stat-Item-2';
const ITEM_3 = 'Dashboard-Stat-Item-3';
const ITEM_USD_A = 'Dashboard-Value-USD-A';
const ITEM_USD_B = 'Dashboard-Value-USD-B';
const ITEM_EUR_A = 'Dashboard-Value-EUR-A';
const WEAR_ITEM = 'Dashboard-Wear-Item';
const LOCATION_1 = 'Dashboard-Stat-Loc-1';
const LOCATION_2 = 'Dashboard-Stat-Loc-2';

// Module-level creds set by the setup test; all subsequent tests share this fresh user.
let creds: { email: string; password: string };

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('dashboard stats — setup', () => {
  test('register fresh user for dashboard tests', async ({ browser }) => {
    creds = await registerUser(browser);
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

test.describe('dashboard stats — empty state', () => {
  test('fresh account shows "No items yet" empty state with CTA', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await expect(page.getByTestId('dashboard-page')).toBeVisible();
    await expect(page.getByText('No items yet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add your first item' })).toBeVisible();
  });
});

// ─── Quick actions ────────────────────────────────────────────────────────────

test.describe('dashboard stats — quick actions', () => {
  test('"Add item" quick action navigates to /items/new', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await page.getByRole('link', { name: 'Add item' }).click();
    await expect(page).toHaveURL(/\/items\/new/);
  });
});

// ─── Item count (sequential, state accumulates) ───────────────────────────────

test.describe('dashboard stats — item count setup', () => {
  test('create 3 active items', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    for (const name of [ITEM_1, ITEM_2, ITEM_3]) {
      await page.goto('/items/new');
      await page.getByLabel('Name *').fill(name);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('item-detail-page')).toBeVisible();
    }
  });
});

test.describe('dashboard stats — item count', () => {
  test('dashboard shows 3 active items after creating 3', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await expect(page.getByTestId('stat-total-items')).toContainText('3');
  });

  test('after archiving 1 item, dashboard shows 2 active items', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM_3 });
    await card.getByRole('button', { name: 'Item options' }).click();
    await page.getByRole('menuitem', { name: 'Archive' }).click();
    await expect(page.getByText('Item archived').first()).toBeVisible();

    await page.goto('/');
    await expect(page.getByTestId('stat-total-items')).toContainText('2');
  });
});

// ─── Location count ───────────────────────────────────────────────────────────

test.describe('dashboard stats — location count setup', () => {
  test('create 2 locations', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    for (const label of [LOCATION_1, LOCATION_2]) {
      await page.goto('/locations');
      await page.getByRole('button', { name: 'Create location' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await page.locator('#create-label').fill(label);
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      await expect(page.locator('[data-testid^="tree-node-"]').filter({ hasText: label })).toBeVisible();
    }
  });
});

test.describe('dashboard stats — location count', () => {
  test('dashboard shows 2 locations after creating 2', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await expect(page.getByTestId('stat-total-locations')).toContainText('2');
  });
});

// ─── Wardrobe value ───────────────────────────────────────────────────────────

test.describe('dashboard stats — wardrobe value setup', () => {
  test('create 2 items with USD prices', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    for (const [name, price] of [[ITEM_USD_A, '50.00'], [ITEM_USD_B, '75.00']] as const) {
      await page.goto('/items/new');
      await page.getByLabel('Name *').fill(name);
      await page.getByLabel('Price').fill(price);
      await page.getByLabel('Currency').fill('USD');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('item-detail-page')).toBeVisible();
    }
  });
});

test.describe('dashboard stats — wardrobe value', () => {
  test('same currency: dashboard shows combined total ($125.00)', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await expect(page.getByTestId('stat-wardrobe-value')).toContainText('$125.00');
  });

  test('different currencies: dashboard shows per-currency breakdown', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_EUR_A);
    await page.getByLabel('Price').fill('30.00');
    await page.getByLabel('Currency').fill('EUR');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    await page.goto('/');
    const valueCard = page.getByTestId('stat-wardrobe-value');
    await expect(valueCard).toContainText('$125.00');
    await expect(valueCard).toContainText('€30.00');
  });
});

// ─── Recently worn ────────────────────────────────────────────────────────────
// Skipped: dashboard has no "recently worn" stat — it only shows "recently added"
// (most recently created item by created_at). The feature to track the last worn
// item is not implemented.
// Bug filed: https://github.com/Outfitte/frontend/issues/126

test.describe('dashboard stats — recently worn', () => {
  test.skip('after logging a wear, dashboard shows recently worn item', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(WEAR_ITEM);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill(new Date().toISOString().split('T')[0]);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('[data-testid="item-detail-page"] form')).not.toBeVisible();

    await page.goto('/');
    await expect(page.getByTestId('stat-recently-worn')).toContainText(WEAR_ITEM);
  });
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

test.describe('dashboard stats — teardown', () => {
  test('delete active items', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    for (const name of [ITEM_1, ITEM_2, ITEM_USD_A, ITEM_USD_B, ITEM_EUR_A]) {
      await page.goto('/items');
      const card = page.getByTestId('item-card').filter({ hasText: name });
      if (await card.isVisible()) {
        await page.getByRole('link', { name: `View ${name}` }).click();
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Confirm delete' }).click();
        await expect(page).toHaveURL(/\/items$/);
      }
    }
  });

  test('delete archived item', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/items?status=archived');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM_3 });
    if (await card.isVisible()) {
      await page.getByRole('link', { name: `View ${ITEM_3}` }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/items$/);
    }
  });

  test('delete locations', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    for (const label of [LOCATION_1, LOCATION_2]) {
      await page.goto('/locations');
      const node = page.locator('[data-testid^="tree-node-"]').filter({ hasText: label });
      if (await node.isVisible()) {
        await node.hover();
        await node.getByRole('button', { name: 'More options' }).click();
        await page.getByRole('menuitem', { name: 'Delete' }).click();
        await expect(page.getByRole('alertdialog')).toBeVisible();
        await page.getByRole('button', { name: 'Delete' }).click();
        await expect(page.getByText('Location deleted').first()).toBeVisible();
      }
    }
  });
});
