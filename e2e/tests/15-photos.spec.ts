import path from 'path';
import { test, expect } from '@playwright/test';
import { adminLogin } from '../helpers';

const PHOTO_ITEM = 'Photo-E2E-Item';
const PHOTO_ITEM_MULTI = 'Photo-E2E-Multi';
const PHOTO_ITEM_NOPHOTO = 'Photo-E2E-NoPhoto';
const FIXTURE = path.join(__dirname, '../fixtures/test-image.jpg');

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

test.describe('item without photo', () => {
  test('create item without photo shows placeholder on card and detail', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(PHOTO_ITEM_NOPHOTO);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);

    // Detail page shows placeholder when no photos
    await expect(page.getByTestId('photo-placeholder')).toBeVisible();

    // Card shows placeholder image
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: PHOTO_ITEM_NOPHOTO });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('item-photo-placeholder')).toBeVisible();
  });
});

test.describe('single photo upload', () => {
  test('create item with a photo — detail page shows gallery', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(PHOTO_ITEM);
    await page.locator('#photo-input').setInputFiles(FIXTURE);
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);

    await expect(page.getByTestId('photo-gallery')).toBeVisible();
    await expect(page.getByTestId('main-photo')).toBeVisible();
  });

  test('item card shows photo image (not placeholder) when photo is set', async ({ page }) => {
    await page.goto('/items');
    const card = page.getByTestId('item-card').filter({ hasText: PHOTO_ITEM });
    await expect(card).toBeVisible();
    await expect(card.getByTestId('item-photo-placeholder')).not.toBeAttached();
  });

  test('upload second photo from edit page — detail shows two thumbnails', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM) }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);
    await expect(page.getByTestId('edit-item-page')).toBeVisible();

    await page.locator('#photo-input').setInputFiles(FIXTURE);
    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);

    // Two photos → thumbnails appear
    await expect(page.getByTestId('photo-thumbnail')).toHaveCount(2);
  });

  test('photo gallery: clicking thumbnail switches the main photo', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM) }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('photo-gallery')).toBeVisible();

    const thumbnails = page.getByTestId('photo-thumbnail');
    await expect(thumbnails).toHaveCount(2);

    // Initially first thumbnail is active (has ring class)
    await expect(thumbnails.nth(0)).toHaveClass(/ring-2/);
    await expect(thumbnails.nth(1)).not.toHaveClass(/ring-2/);

    // Click second thumbnail
    await thumbnails.nth(1).click();
    await expect(thumbnails.nth(1)).toHaveClass(/ring-2/);
    await expect(thumbnails.nth(0)).not.toHaveClass(/ring-2/);
  });

  test('delete one photo from edit page — one photo remains, no thumbnails', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM) }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByTestId('edit-item-page')).toBeVisible();

    // There should be 2 delete buttons (one per existing photo)
    await expect(page.getByRole('button', { name: /Delete photo/ })).toHaveCount(2);

    // Delete first existing photo and wait for it to be removed from local state
    await page.getByRole('button', { name: /Delete photo/ }).first().click();
    await expect(page.getByRole('button', { name: /Delete photo/ })).toHaveCount(1);

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);

    // One photo left → gallery shown, no thumbnails
    await expect(page.getByTestId('photo-gallery')).toBeVisible();
    await expect(page.getByTestId('photo-thumbnail')).toHaveCount(0);
  });

  test('delete last photo — detail page shows placeholder', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM) }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByTestId('edit-item-page')).toBeVisible();

    // Only one photo remains from previous test; wait for delete to propagate
    await expect(page.getByRole('button', { name: /Delete photo/ })).toHaveCount(1);
    await page.getByRole('button', { name: /Delete photo/ }).first().click();
    await expect(page.getByRole('button', { name: /Delete photo/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Save Changes' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);

    // No photos left → placeholder
    await expect(page.getByTestId('photo-placeholder')).toBeVisible();
  });
});

test.describe('multiple photos during creation', () => {
  test('queue two photos before submit — both appear on detail', async ({ page }) => {
    await page.goto('/items/new');
    await page.getByLabel('Name *').fill(PHOTO_ITEM_MULTI);

    // Upload two files at once (multiple attribute is set on the input)
    await page.locator('#photo-input').setInputFiles([FIXTURE, FIXTURE]);

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+$/);

    // Two photos → thumbnails visible
    await expect(page.getByTestId('photo-thumbnail')).toHaveCount(2);
  });
});

test.describe('photo URL accessibility', () => {
  test('main photo src uses /media/ path and returns 200', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM_MULTI) }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByTestId('photo-gallery')).toBeVisible();

    const mainPhoto = page.getByTestId('main-photo');
    const src = await mainPhoto.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/\/media\//);

    // Media endpoint requires JWT; exchange the refresh token (in localStorage) for a fresh access token
    const refreshToken = await page.evaluate(() => localStorage.getItem('refresh_token'));
    const tokenResponse = await page.request.post('/api/auth/refresh', {
      data: { refresh_token: refreshToken },
    });
    const { access_token } = await tokenResponse.json();
    const response = await page.request.get(src!, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    expect(response.status()).toBe(200);
  });
});

test.describe('photo cleanup', () => {
  test('delete Photo-E2E-NoPhoto item', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM_NOPHOTO) }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/items$/);
    await expect(page.getByTestId('item-card').filter({ hasText: PHOTO_ITEM_NOPHOTO })).not.toBeAttached();
  });

  test('delete Photo-E2E-Item item', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM) }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/items$/);
    await expect(page.getByTestId('item-card').filter({ hasText: PHOTO_ITEM })).not.toBeAttached();
  });

  test('delete Photo-E2E-Multi item', async ({ page }) => {
    await page.goto('/items');
    await page.getByRole('link', { name: new RegExp('View ' + PHOTO_ITEM_MULTI) }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page).toHaveURL(/\/items$/);
    await expect(page.getByTestId('item-card').filter({ hasText: PHOTO_ITEM_MULTI })).not.toBeAttached();
  });
});
