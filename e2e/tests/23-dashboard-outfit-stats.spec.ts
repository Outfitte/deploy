import { test, expect } from '../fixtures';
import { registerUser, loginAs } from '../helpers';

const ITEM_NAME = 'DashOutfit-E2E-Item';
const OUTFIT_1 = 'DashOutfit-E2E-1';
const OUTFIT_2 = 'DashOutfit-E2E-2';
const OUTFIT_3 = 'DashOutfit-E2E-3';

let creds: { email: string; password: string };

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('dashboard outfit stats — setup', () => {
  test('register fresh user and create seed item', async ({ browser, page }) => {
    creds = await registerUser(browser);
    await loginAs(page, creds.email, creds.password);
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });
});

// ─── Initial state ────────────────────────────────────────────────────────────

test.describe('dashboard outfit stats — initial state', () => {
  test('no outfits: stat-total-outfits = 0, stat-recent-outfit = —', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await expect(page.getByTestId('stat-total-outfits')).toContainText('0');
    await expect(page.getByTestId('stat-recent-outfit')).toContainText('—');
  });
});

// ─── Outfit count ─────────────────────────────────────────────────────────────

test.describe('dashboard outfit stats — outfit count setup', () => {
  test('create 3 outfits', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    for (const name of [OUTFIT_1, OUTFIT_2, OUTFIT_3]) {
      await page.goto('/outfits/new');
      await page.getByLabel('Name').fill(name);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);
    }
  });
});

test.describe('dashboard outfit stats — outfit count', () => {
  test('dashboard shows 3 after creating 3 outfits', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await expect(page.getByTestId('stat-total-outfits')).toContainText('3');
  });

  test('most recently created outfit shown in Recent outfit card', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/');
    await expect(page.getByTestId('stat-recent-outfit')).toContainText(OUTFIT_3);
  });
});

// ─── Delete drops count ───────────────────────────────────────────────────────

test.describe('dashboard outfit stats — delete', () => {
  test('delete OUTFIT_3 → total drops to 2', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/outfits');
    await page.getByRole('link', { name: 'View ' + OUTFIT_3, exact: true }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/outfits$/);

    await page.goto('/');
    await expect(page.getByTestId('stat-total-outfits')).toContainText('2');
  });
});

// ─── Null name fallback ───────────────────────────────────────────────────────

test.describe('dashboard outfit stats — null name fallback', () => {
  test('outfit with no name shows Untitled outfit in Recent outfit card', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/outfits/new');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);

    await page.goto('/');
    await expect(page.getByTestId('stat-recent-outfit')).toContainText('Untitled outfit');
  });
});

// ─── Teardown ─────────────────────────────────────────────────────────────────

test.describe('dashboard outfit stats — teardown', () => {
  test('delete remaining outfits', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    // OUTFIT_3 is normally deleted by the delete-test above; include it here
    // so teardown is idempotent if the suite is interrupted mid-run.
    for (const name of [OUTFIT_1, OUTFIT_2, OUTFIT_3]) {
      await page.goto('/outfits');
      const card = page.getByTestId('outfit-card').filter({ hasText: name });
      if ((await card.count()) === 0) continue;
      await page.getByRole('link', { name: 'View ' + name, exact: true }).click();
      await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/outfits$/);
    }
  });

  test('delete seed item', async ({ page }) => {
    await loginAs(page, creds.email, creds.password);
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM_NAME });
    if ((await card.count()) === 0) return;
    await page.getByRole('link', { name: 'View ' + ITEM_NAME, exact: true }).click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/items$/);
  });
});
