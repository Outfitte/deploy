import { test, expect } from '../fixtures';
import { loginAs, switchUser } from '../helpers';
import type { Page } from '@playwright/test';

// Pending-transfer lock enforcement across item flows. Verifies the proactive
// client-side lock (UI gating) matches the backend's ErrItemTransferPending
// (409) enforcement, plus the reactive 409 backstop and unlock-on-resolution.
//
// Each `mode: 'serial'` describe is an independently schedulable unit that
// Playwright may run on a separate worker — and every worker gets its own
// isolated Docker stack (see fixtures/worker-stack.ts). So each describe block
// creates the items it needs; it never relies on data created in another block.

const GATING_ITEM = 'Transfer-Lock-Gating-Item'; // proactive UI gating
const OUTFIT_ITEM = 'Transfer-Lock-Outfit-Item'; // outfit-picker reactive 409
const BACKSTOP_ITEM = 'Transfer-Lock-Backstop-Item'; // stale-cache reactive 409
const UNLOCK_ITEM = 'Transfer-Lock-Unlock-Item'; // unlock on cancel

const PENDING_TRANSFER_ERROR = 'item has a pending transfer'; // backend 409 body

async function createItemWithWearLog(page: Page, name: string) {
  await page.goto('/items/new');
  await page.getByLabel('Name *').fill(name);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page).toHaveURL(/\/items\/[^/]+$/);
  await expect(page.getByTestId('item-detail-page')).toBeVisible();

  // A wear log gives the item history worth protecting once locked.
  await page.getByRole('button', { name: 'Log wear' }).click();
  await page.getByLabel('Date').fill('2024-03-01');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.locator('[data-testid="item-detail-page"] form')).not.toBeVisible();
  await expect(page.getByTestId('wear-count')).toHaveText('1');
}

async function sendTransfer(page: Page, itemName: string, recipientEmail: string) {
  await page.goto('/items');
  await page.getByRole('link', { name: `View ${itemName}`, exact: true }).click();
  await expect(page.getByTestId('item-detail-page')).toBeVisible();
  await page.getByRole('button', { name: 'Transfer' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('user-list').getByRole('button', { name: recipientEmail }).click();
  await dialog.getByRole('button', { name: 'Transfer' }).click();
  await expect(page.getByText('Transfer sent').first()).toBeVisible();
  await expect(dialog).not.toBeVisible();
}

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

// ─── Proactive lock: UI gating ────────────────────────────────────────────────

test.describe('transfer-lock — proactive UI gating', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin creates an item with a wear log and sends a pending transfer', async ({
    page,
    recipientCredentials,
  }) => {
    await createItemWithWearLog(page, GATING_ITEM);
    await sendTransfer(page, GATING_ITEM, recipientCredentials.email);
  });

  test('items grid: locked item shows badge; Wore-today and context-menu mutations gated', async ({
    page,
  }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: GATING_ITEM });
    await expect(card).toBeVisible();

    // 'Transfer pending' badge present.
    await expect(card.getByTestId('item-locked-badge')).toBeVisible();
    await expect(card.getByTestId('item-locked-badge')).toHaveText('Transfer pending');

    // 'Wore today' quick action is gated (absent on a locked card).
    await expect(card.getByRole('button', { name: 'Wore today' })).not.toBeAttached();

    // Context-menu mutations are gated: the whole options menu is absent, so
    // there is no Edit/Archive/Dispose/Delete — and no second 'Transfer…' entry.
    await expect(card.getByRole('button', { name: 'Item options' })).not.toBeAttached();
  });

  test('item detail: pending banner present and every mutating affordance is gated', async ({
    page,
  }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${GATING_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    // Pending banner present.
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();

    // Edit / Archive / Share / Dispose / Delete / Transfer / Log-wear all absent.
    for (const name of ['Edit', 'Archive', 'Unarchive', 'Share', 'Dispose', 'Delete', 'Transfer', 'Log wear']) {
      await expect(page.getByRole('button', { name, exact: true })).not.toBeAttached();
    }
    // Edit is rendered as a link, not a button — assert it too.
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).not.toBeAttached();

    // Wear-log delete button is gated even though a wear log exists.
    await expect(page.getByRole('button', { name: 'Delete wear log' })).not.toBeAttached();
  });
});

// ─── Reactive 409: outfit item picker ─────────────────────────────────────────
//
// Documentation point (per issue): F4 did NOT add pending-transfer awareness to
// the F3 outfit item picker. The picker lists every active item — including
// locked ones — so the lock is enforced reactively: adding a locked item hits
// the backend's 409 (ErrItemTransferPending) and surfaces an error toast. The
// outfit page does not crash or navigate away.

test.describe('transfer-lock — outfit picker relies on the 409 backstop', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin creates a locked item and an outfit to add it to', async ({
    page,
    recipientCredentials,
  }) => {
    await createItemWithWearLog(page, OUTFIT_ITEM);
    await sendTransfer(page, OUTFIT_ITEM, recipientCredentials.email);

    // Create the outfit that will receive (attempt) the locked item.
    await page.goto('/outfits/new');
    await page.getByLabel('Name').fill('Transfer-Lock-Outfit');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit$/);
    await expect(page.getByTestId('edit-outfit-page')).toBeVisible();
  });

  test('adding the locked item via the picker surfaces the 409 and the page survives', async ({
    page,
  }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: 'View Transfer-Lock-Outfit', exact: true }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByTestId('edit-outfit-page')).toBeVisible();

    // The picker lists the locked item (no lock awareness in the F3 picker).
    await page.getByRole('button', { name: 'Add item' }).click();
    const picker = page.getByRole('dialog');
    await expect(picker).toBeVisible();
    await picker.getByPlaceholder('Search items…').fill(OUTFIT_ITEM);
    await expect(picker.getByText(OUTFIT_ITEM)).toBeVisible();
    await picker.getByRole('button', { name: 'Add' }).click();

    // Reactive enforcement: backend rejects with 409, error toast shown.
    await expect(page.getByText(PENDING_TRANSFER_ERROR).first()).toBeVisible();

    // Page does not crash or navigate away.
    await expect(page.getByTestId('edit-outfit-page')).toBeVisible();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit$/);
    // The locked item was not added to the outfit's item list.
    await expect(
      page.locator('section li').filter({ hasText: OUTFIT_ITEM })
    ).not.toBeAttached();
  });
});

// ─── Reactive 409: stale-cache backstop on the item detail page ───────────────
//
// Force a stale-cache scenario: keep one session's outgoing-transfers cache
// empty (so the proactive lock never engages) while a second session initiates
// the transfer, then attempt a mutation in the first session. The mutation hits
// the backend's 409; an error toast is shown and the page does not crash.

test.describe('transfer-lock — reactive 409 backstop (stale cache)', () => {
  test.describe.configure({ mode: 'serial' });

  test('a wear-log mutation on a stale page surfaces the 409 without crashing', async ({
    page,
    browser,
    baseURL,
    adminCredentials,
    recipientCredentials,
  }) => {
    await createItemWithWearLog(page, BACKSTOP_ITEM);

    // Pin this session's lock state to "unlocked": the outgoing-transfers query
    // always resolves empty, so the proactive client-side lock never engages —
    // even if React Query refetches on focus. This is the stale-cache the 409
    // backstop must defend against.
    await page.route('**/api/transfers/outgoing', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    );

    // Land on the detail page while still "unlocked": Log wear is available.
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${BACKSTOP_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Log wear' })).toBeVisible();

    // In a second session, the same admin initiates a real transfer of the item.
    const ctx2 = await browser.newContext({ baseURL: baseURL! });
    const page2 = await ctx2.newPage();
    try {
      await loginAs(page2, adminCredentials.email, adminCredentials.password);
      await sendTransfer(page2, BACKSTOP_ITEM, recipientCredentials.email);
    } finally {
      await ctx2.close();
    }

    // First session is now stale (its outgoing cache is still empty). Attempt a
    // wear-log mutation — the POST hits the real backend and is rejected (409).
    await page.getByRole('button', { name: 'Log wear' }).click();
    await page.getByLabel('Date').fill('2024-04-01');
    await page.getByRole('button', { name: 'Save' }).click();

    // Error toast is shown; the page neither crashes nor navigates.
    await expect(page.getByText(PENDING_TRANSFER_ERROR).first()).toBeVisible();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('wear-count')).toHaveText('1'); // unchanged
  });
});

// ─── Unlock on resolution: cancel the transfer ────────────────────────────────

test.describe('transfer-lock — unlock on cancel', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin creates an item with a wear log and sends a pending transfer', async ({
    page,
    recipientCredentials,
  }) => {
    await createItemWithWearLog(page, UNLOCK_ITEM);
    await sendTransfer(page, UNLOCK_ITEM, recipientCredentials.email);
  });

  test('item is locked: grid badge and detail banner present', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: UNLOCK_ITEM });
    await expect(card.getByTestId('item-locked-badge')).toBeVisible();

    await page.getByRole('link', { name: `View ${UNLOCK_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).toBeVisible();
  });

  test('cancelling the transfer restores every affordance; badge and banner gone', async ({
    page,
  }) => {
    // Cancel from the Outgoing tab.
    await page.goto('/transfers');
    await page.getByRole('tab', { name: 'Outgoing' }).click();
    await expect(page.getByTestId('outgoing-transfers')).toBeVisible();
    const row = page.locator('[data-testid^="transfer-row-"]').filter({ hasText: UNLOCK_ITEM });
    await row.getByRole('button', { name: 'Cancel transfer' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm cancel' }).click();
    await expect(page.getByText('Transfer cancelled').first()).toBeVisible();

    // Reload the grid: badge gone, Wore-today and context menu restored.
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: UNLOCK_ITEM });
    await expect(card.getByTestId('item-locked-badge')).not.toBeAttached();
    await expect(card.getByRole('button', { name: 'Wore today' })).toBeVisible();
    await expect(card.getByRole('button', { name: 'Item options' })).toBeVisible();

    // Reload the detail page: banner gone, mutating affordances restored.
    await page.getByRole('link', { name: `View ${UNLOCK_ITEM}`, exact: true }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('item-transfer-banner')).not.toBeAttached();
    await expect(page.getByRole('button', { name: 'Transfer' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Log wear' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Edit', exact: true })).toBeVisible();
  });
});
