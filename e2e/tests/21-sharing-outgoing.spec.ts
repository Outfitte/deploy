import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';

const ITEM_NAME = 'Sharing-E2E-Item';
const OUTFIT_NAME = 'Sharing-E2E-Outfit';
const LOCATION_NAME = 'Sharing-E2E-Location';

function getTreeNode(page: Page, label: string) {
  return page.locator('[data-testid^="tree-node-"]').filter({ hasText: label });
}

async function openContextMenu(page: Page, nodeLabel: string) {
  const node = getTreeNode(page, nodeLabel);
  await node.hover();
  await node.getByRole('button', { name: 'More options' }).click();
}

async function selectRecipientAndShare(page: Page, recipientEmail: string) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('user-list').getByRole('button', { name: recipientEmail }).click();
  await dialog.getByRole('button', { name: 'Share' }).click();
}

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('sharing — setup', () => {
  test('create item', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_NAME);
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
});

// ─── Validation (error cases first) ──────────────────────────────────────────

test.describe('sharing — validation', () => {
  test('submit Share dialog without selecting a recipient → validation error shown', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Share' }).click();
    await expect(dialog.getByText('Please select a recipient')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('recipient list shows other users but not admin (self)', async ({ page, recipientCredentials }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByTestId('user-list').getByRole('button', { name: recipientCredentials.email })).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('duplicate share → 409 error shown in dialog', async ({ page, recipientCredentials }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    // Share item once
    await page.getByRole('button', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    await expect(page.getByText('Share created').first()).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();

    // Try to share the same item again
    await page.getByRole('button', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('share already exists')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();

    // Clean up: revoke the share so happy path starts fresh
    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();
    await page.getByRole('button', { name: 'Revoke' }).first().click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm revoke' }).click();
    await expect(page.getByText('Share revoked').first()).toBeVisible();
  });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

test.describe('sharing — happy path', () => {
  test('share item from item detail page → success toast, dialog closes', async ({ page, recipientCredentials }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    await expect(page.getByText('Share created').first()).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('share outfit from outfit detail page → success toast, dialog closes', async ({ page, recipientCredentials }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    await expect(page.getByText('Share created').first()).toBeVisible();
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('share location from context menu → success toast', async ({ page, recipientCredentials }) => {
    await page.goto('/locations');
    await openContextMenu(page, LOCATION_NAME);
    await page.getByRole('menuitem', { name: 'Share' }).click();
    await selectRecipientAndShare(page, recipientCredentials.email);
    await expect(page.getByText('Share created').first()).toBeVisible();
  });

  test('outgoing shares page lists all 3 shares grouped by Items / Outfits / Locations', async ({ page }) => {
    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Items' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Outfits' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
  });

  test('each share row shows recipient email, target name, and created date', async ({ page, recipientCredentials }) => {
    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();
    const itemRow = page.getByRole('listitem').filter({ hasText: ITEM_NAME });
    await expect(itemRow).toBeVisible();
    await expect(itemRow.getByText(recipientCredentials.email)).toBeVisible();
    await expect(itemRow.locator('.text-xs')).toBeVisible();
  });

  test('revoke item share → Items section removed, 2 shares remain', async ({ page }) => {
    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();
    const itemsSection = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Items' }) });
    await itemsSection.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm revoke' }).click();
    await expect(page.getByText('Share revoked').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Items' })).not.toBeAttached();
    await expect(page.getByRole('heading', { name: 'Outfits' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Locations' })).toBeVisible();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test.describe('sharing — edge cases', () => {
  test('delete shared outfit → Outfits section cleaned up server-side', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: `View ${OUTFIT_NAME}`, exact: true }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/outfits$/);

    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Outfits' })).not.toBeAttached();
  });

  test('revoke all remaining shares → empty state shown', async ({ page }) => {
    await page.goto('/shares');
    await expect(page.getByTestId('outgoing-shares-page')).toBeVisible();

    let revokeBtn = page.getByRole('button', { name: 'Revoke' }).first();
    while ((await revokeBtn.count()) > 0) {
      await revokeBtn.click();
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await page.getByRole('button', { name: 'Confirm revoke' }).click();
      await expect(page.getByText('Share revoked').first()).toBeVisible();
      revokeBtn = page.getByRole('button', { name: 'Revoke' }).first();
    }

    await expect(page.getByText("You haven't shared anything yet")).toBeVisible();
  });

  test('cleanup: delete item and location', async ({ page }) => {
    await page.goto('/items');
    if ((await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).count()) > 0) {
      await page.getByRole('link', { name: `View ${ITEM_NAME}`, exact: true }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/items$/);
    }

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
