import { test, expect } from '../fixtures';
import { switchUser } from '../helpers';
import type { Page } from '@playwright/test';

// Each `mode: 'serial'` describe is an independently schedulable unit that
// Playwright may run on a separate worker — and every worker gets its own
// isolated Docker stack (see fixtures/worker-stack.ts). So each describe block
// creates the items it needs; it never relies on data created in another block.

const VAL_ITEM = 'Transfer-Val-Item'; // validation / locked-button
const ACCEPT_ITEM = 'Transfer-Accept-Item'; // accept-with-history flow
const REJECT_ITEM = 'Transfer-Reject-Item'; // reject flow
const CANCEL_ITEM = 'Transfer-Cancel-Item'; // cancel flow

async function createItem(page: Page, name: string) {
  await page.goto('/items/new');
  await page.getByLabel('Name *').fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/items\/[^/]+$/);
  await expect(page.getByTestId('item-detail-page')).toBeVisible();
}

async function sendTransfer(page: Page, itemName: string, recipientEmail: string, withHistory = false) {
  await page.goto('/items');
  await page.getByRole('link', { name: `View ${itemName}`, exact: true }).click();
  await expect(page.getByTestId('item-detail-page')).toBeVisible();
  await page.getByRole('button', { name: 'Transfer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('user-list').getByRole('button', { name: recipientEmail }).click();
  if (withHistory) {
    await dialog.getByRole('checkbox', { name: 'Include wear history' }).check();
  }
  await dialog.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByText('Transfer sent').first()).toBeVisible();
  await expect(dialog).not.toBeVisible();
}

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

// ─── Validation (error cases first) ──────────────────────────────────────────

test.describe('transfer-history — validation', () => {
  test.describe.configure({ mode: 'serial' });

  test('submit Transfer dialog without selecting a recipient → validation error shown', async ({ page }) => {
    await createItem(page, VAL_ITEM);
    await page.getByRole('button', { name: 'Transfer' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Transfer' }).click();
    await expect(dialog.getByText('Please select a recipient')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });

  test('item with pending transfer → Transfer button absent and banner shown', async ({ page, recipientCredentials }) => {
    // Reuses VAL_ITEM created above — same serial block, same worker/stack.
    await sendTransfer(page, VAL_ITEM, recipientCredentials.email);

    await page.goto('/items');
    await page.getByRole('link', { name: `View ${VAL_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    // Item is locked by the pending transfer — Transfer button is gone, banner present.
    await expect(page.getByRole('button', { name: 'Transfer' })).not.toBeAttached();
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();
  });
});

// ─── Transfer WITH history — accept flow ──────────────────────────────────────

test.describe('transfer-history — accept with history', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin creates item with 2 wear logs and sends transfer with history included', async ({ page, recipientCredentials }) => {
    await createItem(page, ACCEPT_ITEM);

    for (const date of ['2024-01-10', '2024-02-15']) {
      await page.getByRole('button', { name: 'Log wear' }).click();
      await page.getByLabel('Date').fill(date);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('[data-testid="item-detail-page"] form')).not.toBeVisible();
    }
    await expect(page.getByTestId('wear-count')).toHaveText('2');

    await sendTransfer(page, ACCEPT_ITEM, recipientCredentials.email, true);
  });

  test('item shows locked badge in list and transfer banner on detail page', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: ACCEPT_ITEM });
    await expect(card.getByTestId('item-locked-badge')).toBeVisible();

    await page.getByRole('link', { name: `View ${ACCEPT_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Transfer' })).not.toBeAttached();
  });

  test('recipient Incoming tab shows transfer marked history-included', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ACCEPT_ITEM });
    await expect(row).toBeVisible();
    await expect(row.getByText('Wear history included')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).toBeVisible();
  });

  test('recipient accepts transfer → success toast and Accept/Reject buttons gone', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ACCEPT_ITEM });
    await row.getByRole('button', { name: 'Accept' }).click();
    await expect(page.getByText('Transfer accepted').first()).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).not.toBeAttached();
    await expect(row.getByRole('button', { name: 'Reject' })).not.toBeAttached();
  });

  test('recipient finds the item in their /items with the 2 wear logs (history travelled)', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ACCEPT_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('wear-count')).toHaveText('2');
  });

  test('admin Outgoing tab shows the transfer with status accepted', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await expect(page.getByTestId('outgoing-transfers')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: ACCEPT_ITEM });
    await expect(row.getByText('accepted')).toBeVisible();
  });
});

// ─── Reject flow ──────────────────────────────────────────────────────────────

test.describe('transfer-history — reject flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin creates an item and sends a transfer to the recipient', async ({ page, recipientCredentials }) => {
    await createItem(page, REJECT_ITEM);
    await sendTransfer(page, REJECT_ITEM, recipientCredentials.email);
  });

  test('recipient rejects transfer → toast and pending buttons gone', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: REJECT_ITEM });
    await row.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm reject' }).click();
    await expect(page.getByText('Transfer rejected').first()).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).not.toBeAttached();
    await expect(row.getByRole('button', { name: 'Reject' })).not.toBeAttached();
  });

  test('admin: item is unlocked again and affordances restored', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: REJECT_ITEM });
    await expect(card.getByTestId('item-locked-badge')).not.toBeAttached();

    await page.getByRole('link', { name: `View ${REJECT_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Transfer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log wear' })).toBeVisible();
  });

  test('admin Outgoing tab shows the transfer with status rejected', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await expect(page.getByTestId('outgoing-transfers')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: REJECT_ITEM });
    await expect(row.getByText('rejected')).toBeVisible();
  });
});

// ─── Cancel flow ──────────────────────────────────────────────────────────────

test.describe('transfer-history — cancel flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin creates an item and sends a transfer to the recipient', async ({ page, recipientCredentials }) => {
    await createItem(page, CANCEL_ITEM);
    await sendTransfer(page, CANCEL_ITEM, recipientCredentials.email);
  });

  test('item shows locked badge in list and transfer banner on detail page', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: CANCEL_ITEM });
    await expect(card.getByTestId('item-locked-badge')).toBeVisible();

    await page.getByRole('link', { name: `View ${CANCEL_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();
  });

  test('admin cancels the transfer → toast and Outgoing row shows cancelled', async ({ page }) => {
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await expect(page.getByTestId('outgoing-transfers')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: CANCEL_ITEM });
    await row.getByRole('button', { name: 'Cancel transfer' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancel' }).click();
    await expect(page.getByText('Transfer cancelled').first()).toBeVisible();
    await expect(row.getByText('cancelled')).toBeVisible();
  });

  test('admin: item is unlocked, badge gone, affordances restored', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: CANCEL_ITEM });
    await expect(card.getByTestId('item-locked-badge')).not.toBeAttached();

    await page.getByRole('link', { name: `View ${CANCEL_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Transfer' })).toBeVisible();
  });

  test('recipient Incoming tab: cancelled transfer no longer offers Accept/Reject', async ({ page, recipientCredentials }) => {
    await switchUser(page, recipientCredentials.email, recipientCredentials.password);
    await page.goto('/transfers');
    await expect(page.getByTestId('transfers-page')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: CANCEL_ITEM });
    // Backend returns all incoming transfers regardless of status — cancelled row stays visible.
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'Accept' })).not.toBeAttached();
    await expect(row.getByRole('button', { name: 'Reject' })).not.toBeAttached();
  });
});
