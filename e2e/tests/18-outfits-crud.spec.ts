import path from 'path';
import { test, expect } from '../fixtures';

const OUTFIT_NAME = 'Outfits-CRUD-E2E';
const OUTFIT_UPDATED = 'Outfits-CRUD-E2E Updated';
const OUTFIT_NOTES = 'Comfortable for long days';
const ITEM_1 = 'Outfit-E2E-Item-1';
const ITEM_2 = 'Outfit-E2E-Item-2';
const ITEM_3 = 'Outfit-E2E-Item-3';
const FIXTURE = path.join(__dirname, '../fixtures/test-image.jpg');

test.beforeEach(async ({ adminLogin }) => {
  await adminLogin();
});

test.describe('outfits empty state', () => {
  test('outfits page shows empty state with CTA to create first outfit', async ({ page }) => {
    await page.goto('/outfits');
    await expect(page.getByTestId('outfits-page')).toBeVisible();
    await expect(page.getByText('No outfits yet')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create your first outfit' })).toBeVisible();
  });
});

test.describe('outfit CRUD happy path', () => {
  test('create 3 items for the picker', async ({ page }) => {
    for (const name of [ITEM_1, ITEM_2, ITEM_3]) {
      await page.goto('/items/new');
      await page.getByLabel('Name *').fill(name);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(/\/items\/[^/]+$/);
    }
  });

  test('click Create outfit → navigate to /outfits/new', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: 'Create outfit' }).click();
    await expect(page).toHaveURL(/\/outfits\/new/);
    await expect(page.getByTestId('create-outfit-page')).toBeVisible();
  });

  test('fill name and notes, submit → redirected to /outfits/:id/edit', async ({ page }) => {
    await page.goto('/outfits/new');
    await page.getByLabel('Name').fill(OUTFIT_NAME);
    await page.getByLabel('Notes').fill(OUTFIT_NOTES);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+\/edit/);
    await expect(page.getByTestId('edit-outfit-page')).toBeVisible();
  });

  test('add 3 items via item picker — items appear in outfit items section', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: new RegExp('View ' + OUTFIT_NAME) }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByTestId('edit-outfit-page')).toBeVisible();

    for (const itemName of [ITEM_1, ITEM_2, ITEM_3]) {
      await page.getByRole('button', { name: 'Add item' }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.getByPlaceholder('Search items…').fill(itemName);
      // Wait for the filtered result to appear before clicking Add
      await expect(dialog.getByText(itemName)).toBeVisible();
      await dialog.getByRole('button', { name: 'Add' }).click();
      await expect(dialog).not.toBeVisible();
      // Wait for the item to appear in the outfit items list after the API call resolves
      await expect(page.locator('li').filter({ hasText: itemName }).getByRole('button', { name: 'Remove' })).toBeVisible();
    }
  });

  test('upload outfit photo and Save Changes → redirected to outfit detail', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: new RegExp('View ' + OUTFIT_NAME) }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByTestId('edit-outfit-page')).toBeVisible();

    await page.locator('#photo-input').setInputFiles(FIXTURE);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
  });

  test('detail page shows name, notes, all 3 items, and uploaded photo', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: new RegExp('View ' + OUTFIT_NAME) }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();

    await expect(page.getByRole('heading', { name: OUTFIT_NAME })).toBeVisible();
    await expect(page.getByText(OUTFIT_NOTES)).toBeVisible();
    await expect(page.getByTestId('outfit-photo-gallery')).toBeVisible();
    await expect(page.getByTestId('outfit-main-photo')).toBeVisible();

    for (const itemName of [ITEM_1, ITEM_2, ITEM_3]) {
      await expect(page.getByRole('link').filter({ hasText: itemName })).toBeVisible();
    }
  });

  test('item link navigates to item detail page, back goes to outfit', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: new RegExp('View ' + OUTFIT_NAME) }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();

    await page.getByRole('link').filter({ hasText: ITEM_1 }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
  });

  test('edit outfit: update name to Updated, remove ITEM_1', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: new RegExp('View ' + OUTFIT_NAME) }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByTestId('edit-outfit-page')).toBeVisible();

    const nameInput = page.getByLabel('Name');
    await nameInput.clear();
    await nameInput.fill(OUTFIT_UPDATED);

    await page.locator('li').filter({ hasText: ITEM_1 }).getByRole('button', { name: 'Remove' }).click();
    // Wait for the item row to disappear before saving
    await expect(page.locator('li').filter({ hasText: ITEM_1 }).getByRole('button', { name: 'Remove' })).not.toBeAttached();

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/outfits\/[^/]+$/);
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();
  });

  test('detail page reflects updated name and only 2 items remain', async ({ page }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: new RegExp('View ' + OUTFIT_UPDATED) }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();

    await expect(page.getByRole('heading', { name: OUTFIT_UPDATED })).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: ITEM_2 })).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: ITEM_3 })).toBeVisible();
    await expect(page.getByRole('link').filter({ hasText: ITEM_1 })).not.toBeAttached();
  });

  test('delete outfit: confirmation dialog → confirm → redirected to /outfits → outfit gone', async ({
    page,
  }) => {
    await page.goto('/outfits');
    await page.getByRole('link', { name: new RegExp('View ' + OUTFIT_UPDATED) }).click();
    await expect(page.getByTestId('outfit-detail-page')).toBeVisible();

    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await expect(page).toHaveURL(/\/outfits$/);
    await expect(page.getByTestId('outfits-page')).toBeVisible();
    await expect(
      page.getByTestId('outfit-card').filter({ hasText: OUTFIT_UPDATED }),
    ).not.toBeAttached();
  });

  test('cleanup: delete E2E items', async ({ page }) => {
    for (const name of [ITEM_1, ITEM_2, ITEM_3]) {
      await page.goto('/items');
      const card = page.getByTestId('item-card').filter({ hasText: name });
      if ((await card.count()) === 0) continue;
      await page.getByRole('link', { name: new RegExp('View ' + name) }).click();
      await page.getByRole('button', { name: 'Delete' }).click();
      await page.getByRole('button', { name: 'Confirm delete' }).click();
      await expect(page).toHaveURL(/\/items$/);
    }
  });
});
