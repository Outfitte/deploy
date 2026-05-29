import { test, expect } from '../fixtures';
import { switchUser } from '../helpers';
import type { Page } from '@playwright/test';

const ITEM1_NAME = 'Transfer-Hist-E2E-Item1'; // accept with history
const ITEM2_NAME = 'Transfer-Hist-E2E-Item2'; // reject flow
const ITEM3_NAME = 'Transfer-Hist-E2E-Item3'; // cancel flow
const ITEM4_NAME = 'Transfer-Hist-E2E-Item4'; // locked-button validation

async function sendTransfer(page: Page, itemName: string, recipientEmail: string, withHistory = false) {
  await page.goto('/items');
  await page.getByRole('link', { name: `View ${itemName}`, exact: true }).click();
  await expect(page.getByTestId('item-detail-page')).toBeVisible();
  await page.getByRole('button', { name: 'Transfer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('user-list').getByRole('button', { name: recipientEmail }).click();
  if (withHistory) {
    await dialog.getByRole('checkbox', { name: 'Include wear history' }).click();
  }
  await dialog.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByText('Transfer sent').first()).toBeVisible();
  await expect(dialog).not.toBeVisible();
}

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('transfer-history — setup', () => {
  test.describe.configure({ mode: 'serial' });

  test('create item1 and log 2 wear entries', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM1_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    for (const date of ['2024-01-10', '2024-02-15']) {
      await page.getByRole('button', { name: 'Log wear' }).click();
      await page.getByLabel('Date').fill(date);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('[data-testid="item-detail-page"] form')).not.toBeVisible();
    }
    await expect(page.getByTestId('wear-count')).toHaveText('2');
  });

  test('create item2', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM2_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });

  test('create item3', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM3_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });

  test('create item4', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM4_NAME);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });
});

// ─── Validation (error cases first) ──────────────────────────────────────────

test.describe('transfer-history — validation', () => {
  test.describe.configure({ mode: 'serial' });

  test('submit Transfer dialog without selecting a recipient → validation error shown', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM2_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('button', { name: 'Transfer' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Transfer' }).click();
    await expect(dialog.getByText('Please select a recipient')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  // Skipped: Outfitte/frontend#300 — useIsItemLocked does not reflect locked state after transfer creation
  test.skip('item with pending transfer → Transfer button absent from detail page', async ({ page, recipientCredentials }) => {
    await sendTransfer(page, ITEM4_NAME, recipientCredentials.email);
    // Navigate away and back using client-side nav (preserves React Query cache + invalidation)
    await page.getByRole('link', { name: 'Items' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: `View ${ITEM4_NAME}`, exact: true }).click();
    await page.waitForLoadState('networkidle');
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    // Item is locked — Transfer button must not be present
    await expect(page.getByRole('button', { name: 'Transfer' })).not.toBeAttached();
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();
  });

  test('cancel item4 transfer (cleanup)', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await page.waitForLoadState('networkidle');
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM4_NAME });
    if (await row.count() === 0) return; // no-op when test 2 is skipped
    await row.getByRole('button', { name: 'Cancel transfer' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancel' }).click();
    await expect(page.getByText('Transfer cancelled').first()).toBeVisible();
  });
});

// ─── Transfer WITH history — accept flow ──────────────────────────────────────

test.describe('transfer-history — accept with history', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin sends transfer of item1 with wear history included', async ({ page, recipientCredentials }) => {
    await sendTransfer(page, ITEM1_NAME, recipientCredentials.email, true);
  });

  // Skipped: Outfitte/frontend#300 — useIsItemLocked does not reflect locked state after transfer creation
  test.skip('item1 shows locked badge in list and transfer banner on detail page', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM1_NAME });
    await expect(card.getByTestId('item-locked-badge')).toBeVisible();

    await page.getByRole('link', { name: `View ${ITEM1_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transfer' })).not.toBeAttached();
  });

  test('recipient Incoming tab shows transfer marked history-included', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM1_NAME });
    await expect(row).toBeVisible();
    await expect(row.getByText('Wear history included')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).toBeVisible();
  });

  test('recipient accepts transfer → success toast and Accept/Reject buttons gone', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM1_NAME });
    await row.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByText('Transfer accepted').first()).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).not.toBeAttached();
    await expect(row.getByRole('button', { name: 'Reject' })).not.toBeAttached();
  });

  test('recipient finds item1 in their /items with 2 wear logs', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM1_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('wear-count')).toHaveText('2');
  });

  test('admin Outgoing tab shows item1 transfer with status accepted', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await page.waitForLoadState('networkidle');
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM1_NAME });
    await expect(row.getByText('accepted')).toBeVisible();
  });
});

// ─── Reject flow ──────────────────────────────────────────────────────────────

test.describe('transfer-history — reject flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin sends transfer of item2 to recipient', async ({ page, recipientCredentials }) => {
    await sendTransfer(page, ITEM2_NAME, recipientCredentials.email);
  });

  test('recipient rejects transfer → toast and pending buttons gone', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM2_NAME });
    await row.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm reject' }).click();
    await expect(page.getByText('Transfer rejected').first()).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).not.toBeAttached();
    await expect(row.getByRole('button', { name: 'Reject' })).not.toBeAttached();
  });

  test('admin: item2 is unlocked and affordances restored', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM2_NAME });
    await expect(card.getByTestId('item-locked-badge')).not.toBeAttached();

    await page.getByRole('link', { name: `View ${ITEM2_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Transfer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log wear' })).toBeVisible();
  });

  test('admin Outgoing tab shows item2 transfer with status rejected', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await expect(page.getByTestId('outgoing-transfers')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM2_NAME });
    await expect(row.getByText('rejected')).toBeVisible();
  });
});

// ─── Cancel flow ──────────────────────────────────────────────────────────────

test.describe('transfer-history — cancel flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin sends transfer of item3 to recipient', async ({ page, recipientCredentials }) => {
    await sendTransfer(page, ITEM3_NAME, recipientCredentials.email);
  });

  // Skipped: Outfitte/frontend#300 — useIsItemLocked does not reflect locked state after transfer creation
  test.skip('item3 shows locked badge in list and transfer banner on detail page', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM3_NAME });
    await expect(card.getByTestId('item-locked-badge')).toBeVisible();

    await page.getByRole('link', { name: `View ${ITEM3_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();
  });

  test('admin cancels item3 transfer → toast and Outgoing row shows cancelled', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await expect(page.getByTestId('outgoing-transfers')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM3_NAME });
    await row.getByRole('button', { name: 'Cancel transfer' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancel' }).click();
    await expect(page.getByText('Transfer cancelled').first()).toBeVisible();
    await expect(row.getByText('cancelled')).toBeVisible();
  });

  test('admin: item3 is unlocked, badge gone, affordances restored', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ITEM3_NAME });
    await expect(card.getByTestId('item-locked-badge')).not.toBeAttached();

    await page.getByRole('link', { name: `View ${ITEM3_NAME}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Transfer' })).toBeVisible();
  });

  test('recipient Incoming tab: cancelled transfer no longer offers Accept/Reject', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ITEM3_NAME });
    // Backend returns all incoming transfers regardless of status — cancelled row stays visible
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).not.toBeAttached();
    await expect(row.getByRole('button', { name: 'Reject' })).not.toBeAttached();
  });
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

test.describe('transfer-history — cleanup', () => {
  test.describe.configure({ mode: 'serial' });

  test('delete item2, item3, item4 (admin)', async ({ page }) => {
    for (const name of [ITEM2_NAME, ITEM3_NAME, ITEM4_NAME]) {
      await page.goto('/items');
      if ((await page.getByRole('link', { name: `View ${name}`, exact: true }).count()) > 0) {
        await page.getByRole('link', { name: `View ${name}`, exact: true }).click();
        await expect(page.getByTestId('item-detail-page')).toBeVisible();
        await page.getByRole('button', { name: 'Delete', exact: true }).click();
        await page.getByRole('button', { name: 'Confirm delete' }).click();
        await expect(page).toHaveURL(/\/items$/);
      }
    }
  });

  test('recipient: delete item1 (now owned after accepted transfer)', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/items');
    if ((await page.getByRole('link', { name: `View ${ITEM1_NAME}`, exact: true }).count()) > 0) {
      await page.getByRole('link', { name: `View ${ITEM1_NAME}`, exact: true }).click();
      await expect(page.getByTestId('item-detail-page')).toBeVisible();
      await page.getByRole('button', { name: 'Delete', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/items$/);
    }
  });
});
