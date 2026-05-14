import { test, expect } from '../fixtures';
import { switchUser } from '../helpers';
import type { Page } from '@playwright/test';

const ITEM_NAME = 'Recipient-E2E-Item';
const ITEM2_NAME = 'Recipient-E2E-Item2';
const OUTFIT_NAME = 'Recipient-E2E-Outfit';
const LOCATION_NAME = 'Recipient-E2E-Location';

async function selectLocation(page: Page, locationLabel: string) {
  await page.getByLabel('Location').evaluate((el, label) => {
    const select = el as HTMLSelectElement;
    const opt = Array.from(select.options).find((o) => o.text.endsWith(label));
    if (opt) select.value = opt.value;
  }, locationLabel);
  await page.getByLabel('Location').dispatchEvent('change');
}

async function selectRecipientAndShare(page: Page, recipientEmail: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('user-list').getByRole('button', { name: recipientEmail }).click();
  await dialog.getByRole('button', { name: 'Share' }).click();
}

function getTreeNode(page: Page, label: string) {
  return page.locator('[data-testid^="tree-node-"]').filter({ hasText: label });
}

async function openContextMenu(page: Page, nodeLabel: string) {
  const node = getTreeNode(page, nodeLabel);
  await node.hover();
  await node.getByRole('button', { name: 'More options' }).click();
}

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

// ─── Setup ─────────────────────────────────────────────────────────────────────

test.describe('sharing-recipient — setup', () => {
  test.describe.configure({ mode: 'serial' });

  test('create location', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('button', { name: 'Create location' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.locator('#create-label').fill(LOCATION_NAME);
    await page.getByRole('button', { name: 'Create' }).click();
    await expect(dialog).not.toBeVisible();
    await expect(getTreeNode(page, LOCATION_NAME)).toBeVisible();
  });

  test('create item1 with brand in location', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_NAME);
    await page.getByLabel('Brand').fill('BrandTest-E2E');
    await selectLocation(page, LOCATION_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });

  test('create item2 in location (for inheritance visibility)', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM2_NAME);
    await selectLocation(page, LOCATION_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });

  test('create outfit', async ({ page }) => {
    await page.goto('/outfits/new');
    await page.getByLabel('Name').fill(OUTFIT_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);
  });

  test('share item1 with recipient', async ({ page, recipientCredentials }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    await expect(page.getByText('Share created').first()).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('share outfit with recipient', async ({ page, recipientCredentials }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    await expect(page.getByText('Share created').first()).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('share location with recipient', async ({ page, recipientCredentials }) => {
    await page.goto('/locations');
    await openContextMenu(page, LOCATION_NAME);
    await page.getByRole('menuitem', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    await expect(page.getByText('Share created').first()).toBeVisible();
  });
});

// ─── Happy path ─────────────────────────────────────────────────────────────────

test.describe('sharing-recipient — happy path', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
  });

  test('/shared shows Items, Outfits, Locations sections', async ({ page }) => {
    await page.goto('/shared');
    await expect(page.getByTestId('shared-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Outfits' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
  });

  test('item card shows shared-by badge with admin email', async ({ page, adminCredentials }) => {
    await page.goto('/shared');
    await expect(page.getByTestId('shared-page')).toBeVisible();
    await expect(page.getByTestId('item-shared-badge').first()).toBeVisible();
    await expect(page.getByTestId('item-shared-badge').first()).toContainText(adminCredentials.email);
  });

  test('outfit card shows shared-by badge with admin email', async ({ page, adminCredentials }) => {
    await page.goto('/shared');
    await expect(page.getByTestId('shared-page')).toBeVisible();
    await expect(page.getByTestId('outfit-shared-badge').first()).toBeVisible();
    await expect(page.getByTestId('outfit-shared-badge').first()).toContainText(adminCredentials.email);
  });

  test('click item card → /shared/items/:id, name and brand visible', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page).toHaveURL(/\/shared\/items\/[^/]+$/);
    await expect(page.getByTestId('shared-item-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(ITEM_NAME);
    await expect(page.getByText('BrandTest-E2E')).toBeVisible();
  });

  test('shared item detail: shared-by banner shows admin email', async ({ page, adminCredentials }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('shared-item-detail-page')).toBeVisible();
    await expect(page.getByTestId('shared-by-banner')).toContainText(adminCredentials.email);
  });

  test('shared item detail: no action buttons present', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('shared-item-detail-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Archive' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Share' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: /[Ll]og wear/i })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Wore today' })).not.toBeAttached();
  });

  test('click outfit card → /shared/outfits/:id, name visible', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
    await expect(page).toHaveURL(/\/shared\/outfits\/[^/]+$/);
    await expect(page.getByTestId('shared-outfit-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(OUTFIT_NAME);
  });

  test('shared outfit detail: shared-by banner shows admin email', async ({ page, adminCredentials }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
    await expect(page.getByTestId('shared-outfit-detail-page')).toBeVisible();
    await expect(page.getByTestId('shared-by-banner')).toContainText(adminCredentials.email);
  });

  test('shared outfit detail: no action buttons present', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
    await expect(page.getByTestId('shared-outfit-detail-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Share' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: /[Ll]og wear/i })).not.toBeAttached();
    await expect(page.getByRole('button', { name: /[Aa]dd item/i })).not.toBeAttached();
    await expect(page.getByRole('button', { name: /[Rr]emove item/i })).not.toBeAttached();
  });

  test('click location → /shared/locations/:id, label and shared-by banner visible', async ({ page, adminCredentials }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: LOCATION_NAME }).click();
    await expect(page).toHaveURL(/\/shared\/locations\/[^/]+$/);
    await expect(page.getByTestId('shared-location-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(LOCATION_NAME);
    await expect(page.getByTestId('shared-by-banner')).toContainText(adminCredentials.email);
  });

  test('shared location: both items listed', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: LOCATION_NAME }).click();
    await expect(page.getByTestId('shared-location-detail-page')).toBeVisible();
    await expect(page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: `View ${ITEM2_NAME}`, exact: true })).toBeVisible();
  });

  test('shared location: no create/modify/delete controls', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: LOCATION_NAME }).click();
    await expect(page.getByTestId('shared-location-detail-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create location' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Share' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Delete' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Rename' })).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'More options' })).not.toBeAttached();
  });

  test('directly shared item in location links to /shared/items/:id', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: LOCATION_NAME }).click();
    await expect(page.getByTestId('shared-location-detail-page')).toBeVisible();
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page).toHaveURL(/\/shared\/items\/[^/]+$/);
    await expect(page.getByTestId('shared-item-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(ITEM_NAME);
  });
});

// ─── Boundary cases ────────────────────────────────────────────────────────────

test.describe('sharing-recipient — boundary cases', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
  });

  test("recipient's /items page shows no items (shared items not included)", async ({ page }) => {
    await page.goto('/items');
    // Recipient has no own items — shared items must NOT appear here
    await expect(page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true })).not.toBeVisible();
    await expect(page.getByRole('link', { name: `View ${ITEM2_NAME}`, exact: true })).not.toBeVisible();
  });

  test("recipient's /outfits page shows no outfits (shared outfits not included)", async ({ page }) => {
    await page.goto('/outfits');
    await expect(page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true })).not.toBeVisible();
  });

  test("recipient's /locations page shows no locations (shared locations not included)", async ({ page }) => {
    await page.goto('/locations');
    await expect(getTreeNode(page, LOCATION_NAME)).not.toBeVisible();
  });

  test('no Share button on shared item detail page', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('shared-item-detail-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share' })).not.toBeAttached();
  });

  test('no Share button on shared outfit detail page', async ({ page }) => {
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
    await expect(page.getByTestId('shared-outfit-detail-page')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Share' })).not.toBeAttached();
  });
});

// ─── Revocation ─────────────────────────────────────────────────────────────────

test.describe('sharing-recipient — revocation', () => {
  test.describe.configure({ mode: 'serial' });

  // Captured in the first test and read in the last — describe-scoped so it
  // stays within this serial block and avoids cross-describe-block coupling.
  let revokedItemId = '';

  test('capture shared item id as recipient (before revocation)', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/shared');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page).toHaveURL(/\/shared\/items\/[^/]+$/);
    revokedItemId = page.url().split('/').pop()!;
    expect(revokedItemId).not.toBe('');
  });

  test('admin revokes item share', async ({ page }) => {
    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();
    const itemsSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Items' }) });
    await itemsSection.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm revoke' }).click();
    await expect(page.getByText('Share revoked').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Items' })).not.toBeAttached();
  });

  test('recipient /shared page: Items section disappears after item share revoked', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/shared');
    await expect(page.getByTestId('shared-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Items' })).not.toBeAttached();
    // Outfits and Locations sections still present
    await expect(page.getByRole('heading', { name: 'Outfits' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
  });

  test('/shared/items/:id after revocation → item not found state', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto(`/shared/items/${revokedItemId}`);
    await expect(page.getByTestId('shared-item-detail-page')).toBeVisible();
    await expect(page.getByText('Item not found')).toBeVisible();
  });
});

// ─── Cleanup ────────────────────────────────────────────────────────────────────

test.describe('sharing-recipient — cleanup', () => {
  test.describe.configure({ mode: 'serial' });

  test('revoke all remaining shares', async ({ page }) => {
    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();
    let revokeBtn = page.getByRole('button', { name: 'Revoke', exact: true }).first();
    for (let i = 0; i < 10 && (await revokeBtn.count()) > 0; i++) {
      await revokeBtn.click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm revoke' }).click();
      await expect(page.getByRole('alertdialog')).not.toBeVisible();
      await expect(page.getByText('Share revoked').first()).toBeVisible();
      revokeBtn = page.getByRole('button', { name: 'Revoke', exact: true }).first();
    }
  });

  test('delete items', async ({ page }) => {
    for (const name of [ITEM_NAME, ITEM2_NAME]) {
      await page.goto('/items');
      if ((await page.getByRole('link', { name: `View ${name}`, exact: true }).count()) > 0) {
        await page.getByRole('link', { name: `View ${name}`, exact: true }).click();
        await page.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Confirm delete' }).click();
        await expect(page).toHaveURL(/\/items$/);
      }
    }
  });

  test('delete outfit', async ({ page }) => {
    await page.goto('/outfits');
    if ((await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).count()) > 0) {
      await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/outfits$/);
    }
  });

  test('delete location', async ({ page }) => {
    await page.goto('/locations');
    if ((await getTreeNode(page, LOCATION_NAME).count()) > 0) {
      await openContextMenu(page, LOCATION_NAME);
      await page.getByRole('menuitem', { name: 'Delete' }).click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect(page.getByText('Location deleted').first()).toBeVisible();
    }
  });
});
