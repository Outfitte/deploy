import { test, expect, type Page } from '@playwright/test';
import { adminLogin } from '../helpers';

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

const ITEM_NAME = 'Location-E2E-Item';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getTreeNode(page: Page, label: string) {
  return page.locator('[data-testid^="tree-node-"]').filter({ hasText: label });
}

async function openContextMenu(page: Page, nodeLabel: string) {
  const node = getTreeNode(page, nodeLabel);
  await node.hover();
  await node.getByRole('button', { name: 'More options' }).click();
}

// Selects a <select> option whose visible text ends with `labelSuffix`.
// Necessary because the location selects prefix depth-indented labels with em-dashes.
async function selectByLabelSuffix(page: Page, selector: string, labelSuffix: string) {
  const value = await page.locator(selector).evaluate((el, suffix) => {
    const option = Array.from((el as HTMLSelectElement).options)
      .find(o => o.text.trim().endsWith(suffix));
    return option?.value ?? '';
  }, labelSuffix);
  await page.locator(selector).selectOption(value);
}

async function createLocation(page: Page, label: string, parentLabel?: string) {
  await page.getByRole('button', { name: 'Create location' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.locator('#create-label').fill(label);
  if (parentLabel) {
    await selectByLabelSuffix(page, '#create-parent', parentLabel);
  }
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
}

async function deleteLocation(page: Page, nodeLabel: string) {
  await openContextMenu(page, nodeLabel);
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();
  // Use .first() to avoid strict-mode violations when multiple delete toasts stack
  await expect(page.getByText('Location deleted').first()).toBeVisible();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

test.describe('locations — setup', () => {
  test('empty state is shown when no locations exist', async ({ page }) => {
    await page.goto('/locations');
    await expect(page.getByTestId('locations-page')).toBeVisible();
    await expect(page.getByText('No locations yet')).toBeVisible();
  });

  test('create root location Bedroom', async ({ page }) => {
    await page.goto('/locations');
    await createLocation(page, 'Bedroom');
    await expect(page.getByText('Location created')).toBeVisible();
    await expect(getTreeNode(page, 'Bedroom')).toBeVisible();
  });

  test('create child location Wardrobe under Bedroom', async ({ page }) => {
    await page.goto('/locations');
    await createLocation(page, 'Wardrobe', 'Bedroom');
    await expect(page.getByText('Location created')).toBeVisible();
    await expect(getTreeNode(page, 'Wardrobe')).toBeVisible();
  });

  test('create grandchild Top Shelf under Wardrobe', async ({ page }) => {
    await page.goto('/locations');
    await createLocation(page, 'Top Shelf', 'Wardrobe');
    await expect(page.getByText('Location created')).toBeVisible();
    await expect(getTreeNode(page, 'Top Shelf')).toBeVisible();
  });

  test('tree shows Bedroom, Wardrobe, and Top Shelf all expanded', async ({ page }) => {
    await page.goto('/locations');
    await expect(getTreeNode(page, 'Bedroom')).toBeVisible();
    await expect(getTreeNode(page, 'Wardrobe')).toBeVisible();
    await expect(getTreeNode(page, 'Top Shelf')).toBeVisible();
  });

  test('collapsing Bedroom hides Wardrobe and Top Shelf', async ({ page }) => {
    await page.goto('/locations');
    const bedroomNode = getTreeNode(page, 'Bedroom');
    await bedroomNode.locator('[data-testid^="toggle-"]').click();
    await expect(getTreeNode(page, 'Wardrobe')).not.toBeVisible();
    await expect(getTreeNode(page, 'Top Shelf')).not.toBeVisible();
    // Re-expand
    await bedroomNode.locator('[data-testid^="toggle-"]').click();
    await expect(getTreeNode(page, 'Wardrobe')).toBeVisible();
  });

  test('create item assigned to Top Shelf', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(ITEM_NAME);
    await selectByLabelSuffix(page, '[aria-label="Location"]', 'Top Shelf');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('location-breadcrumb')).toContainText('Top Shelf');
  });
});

// ─── Validation (error cases first) ──────────────────────────────────────────

test.describe('locations — validation', () => {
  test('create location with empty label — form validation prevents submission', async ({ page }) => {
    await page.goto('/locations');
    await page.getByRole('button', { name: 'Create location' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Create' }).click();
    // Dialog stays open with validation error
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/required/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('delete location with children — specific error message shown', async ({ page }) => {
    await page.goto('/locations');
    await openContextMenu(page, 'Bedroom');
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog').getByText(/has child locations/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
  });

  test('delete location with assigned items — specific error message shown', async ({ page }) => {
    await page.goto('/locations');
    await openContextMenu(page, 'Top Shelf');
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog').getByText(/has assigned items/i)).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('alertdialog')).not.toBeVisible();
  });

  test('move dialog disables descendants to prevent cycles', async ({ page }) => {
    await page.goto('/locations');
    await openContextMenu(page, 'Bedroom');
    await page.getByRole('menuitem', { name: 'Move' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Wardrobe and Top Shelf are descendants of Bedroom — they must be disabled
    await expect(dialog.getByRole('button', { name: 'Wardrobe' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Top Shelf' })).toBeDisabled();
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).not.toBeVisible();
  });
});

// ─── Happy path (sequential, state accumulates) ───────────────────────────────
// Pre-condition: Bedroom → Wardrobe → Top Shelf, item assigned to Top Shelf.

test.describe('locations — happy path', () => {
  test('rename Wardrobe to Main Wardrobe — tree updates', async ({ page }) => {
    await page.goto('/locations');
    await openContextMenu(page, 'Wardrobe');
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const renameInput = page.locator('[data-testid^="rename-input-"]');
    await expect(renameInput).toBeVisible();
    await renameInput.fill('Main Wardrobe');
    await renameInput.press('Enter');
    await expect(page.getByText('Location updated')).toBeVisible();
    await expect(getTreeNode(page, 'Main Wardrobe')).toBeVisible();
  });

  test('select Top Shelf — item visible in detail panel', async ({ page }) => {
    await page.goto('/locations');
    await getTreeNode(page, 'Top Shelf').click();
    await expect(page.getByTestId('location-detail-panel')).toBeVisible();
    await expect(page.getByTestId('location-detail-panel')).toContainText(ITEM_NAME);
  });

  test('move Top Shelf to root — tree updates and toast confirms', async ({ page }) => {
    await page.goto('/locations');
    await openContextMenu(page, 'Top Shelf');
    await page.getByRole('menuitem', { name: 'Move' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await page.getByTestId('move-option-root').click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByText('Location moved')).toBeVisible();
    await expect(getTreeNode(page, 'Top Shelf')).toBeVisible();
  });

  test('item remains assigned to Top Shelf after move', async ({ page }) => {
    await page.goto('/locations');
    await getTreeNode(page, 'Top Shelf').click();
    await expect(page.getByTestId('location-detail-panel')).toBeVisible();
    await expect(page.getByTestId('location-detail-panel')).toContainText(ITEM_NAME);
  });

  test('unassign item from Top Shelf by editing location to None', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM_NAME}` }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await page.locator('[aria-label="Location"]').selectOption('');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('location-breadcrumb')).not.toBeVisible();
  });

  test('delete Top Shelf (no children, no items) — succeeds', async ({ page }) => {
    await page.goto('/locations');
    await deleteLocation(page, 'Top Shelf');
    await expect(getTreeNode(page, 'Top Shelf')).not.toBeVisible();
  });

  test('delete Main Wardrobe (no children, no items) — succeeds', async ({ page }) => {
    await page.goto('/locations');
    await deleteLocation(page, 'Main Wardrobe');
    await expect(getTreeNode(page, 'Main Wardrobe')).not.toBeVisible();
  });

  test('delete Bedroom (no children) — succeeds and page shows empty state', async ({ page }) => {
    await page.goto('/locations');
    await deleteLocation(page, 'Bedroom');
    await expect(page.getByText('No locations yet')).toBeVisible();
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

test.describe('locations — edge cases', () => {
  test('create location at root level (no parent) — works', async ({ page }) => {
    await page.goto('/locations');
    await createLocation(page, 'Closet');
    await expect(getTreeNode(page, 'Closet')).toBeVisible();
    // Clean up
    await deleteLocation(page, 'Closet');
    await expect(page.getByText('No locations yet')).toBeVisible();
  });

  test('tree with 3+ levels renders with increasing indentation', async ({ page }) => {
    await page.goto('/locations');
    await createLocation(page, 'L1');
    await createLocation(page, 'L2', 'L1');
    await createLocation(page, 'L3', 'L2');

    const l1Node = getTreeNode(page, 'L1');
    const l2Node = getTreeNode(page, 'L2');
    const l3Node = getTreeNode(page, 'L3');

    await expect(l1Node).toBeVisible();
    await expect(l2Node).toBeVisible();
    await expect(l3Node).toBeVisible();

    // Each level is indented further (depth * 16 + 8 px per the component's paddingLeft style)
    const l1Left = await l1Node.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    const l2Left = await l2Node.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
    const l3Left = await l3Node.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));

    expect(l2Left).toBeGreaterThan(l1Left);
    expect(l3Left).toBeGreaterThan(l2Left);

    // Clean up — delete deepest first
    await deleteLocation(page, 'L3');
    await deleteLocation(page, 'L2');
    await deleteLocation(page, 'L1');
  });

  test('item cleared from location is no longer shown in location detail panel', async ({ page }) => {
    // Item was unassigned from Top Shelf in happy path; verify it has no location now
    await page.goto('/items');
    await page.getByRole('link', { name: `View ${ITEM_NAME}` }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('location-breadcrumb')).not.toBeVisible();
  });
});
