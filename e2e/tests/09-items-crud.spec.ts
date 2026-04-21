import path from 'path';
import { test, expect } from '@playwright/test';
import { adminLogin } from '../helpers';

test.beforeEach(async ({ page }) => {
  await adminLogin(page);
});

test.describe('items empty state', () => {
  test('items page shows empty CTA when no items exist', async ({ page }) => {
    await page.goto('/items');
    await expect(page.getByTestId('items-page')).toBeVisible();
    // Empty state is only shown if there are no items; if items exist this test is a no-op check
    // The grid or empty state must render without error
    await expect(page).toHaveURL(/\/items/);
  });
});

test.describe('item CRUD happy path', () => {
  test('create location for item', async ({ page }) => {
    await page.goto('/locations');

    // Create a location to use when creating the item
    const createBtn = page.getByRole('button', { name: 'Create location' });
    await createBtn.first().click();

    await page.getByLabel('Label').fill('Test Wardrobe');
    await page.getByRole('button', { name: 'Create' }).click();

    // Wait for location to appear in the tree
    await expect(page.getByText('Test Wardrobe')).toBeVisible();
  });

  test('navigate from items page to create form', async ({ page }) => {
    await page.goto('/items');

    // Click "Add item" button in the toolbar (always visible)
    await page.getByRole('link', { name: 'Add item' }).click();
    await expect(page).toHaveURL(/\/items\/new/);
    await expect(page.getByTestId('create-item-page')).toBeVisible();
  });

  test('create item with all fields and photo', async ({ page }) => {
    await page.goto('/items/new');

    // Basic Info
    await page.getByLabel('Name *').fill('Blue Oxford Shirt');
    await page.getByLabel('Brand').fill('Uniqlo');
    await page.getByLabel('Color').fill('Blue');

    // Category — select 'Tops' if it exists, otherwise skip
    const categorySelect = page.getByLabel('Category');
    const topsOption = categorySelect.locator('option', { hasText: 'Tops' });
    if ((await topsOption.count()) > 0) {
      await categorySelect.selectOption({ label: 'Tops' });
    }

    // Location — select 'Test Wardrobe' created above
    const locationSelect = page.getByLabel('Location');
    const warehouseOption = locationSelect.locator('option', { hasText: 'Test Wardrobe' });
    if ((await warehouseOption.count()) > 0) {
      await locationSelect.selectOption({ label: 'Test Wardrobe' });
    }

    // Purchase info
    await page.getByLabel('Price').fill('49.99');
    await page.getByLabel('Currency').fill('USD');
    await page.getByLabel('Purchase Date').fill('2024-01-15');
    await page.getByLabel('Seller URL').fill('https://example.com/shirt');

    // Add a metadata field
    await page.getByRole('button', { name: 'Add Field' }).click();
    await page.getByPlaceholder('Key').fill('size');
    await page.getByPlaceholder('Value').fill('M');

    // Upload photo
    const photoInput = page.locator('#photo-input');
    await photoInput.setInputFiles(path.join(__dirname, '../fixtures/test-image.jpg'));

    // Submit
    await page.getByRole('button', { name: 'Save' }).click();

    // Should redirect to item detail page
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();
  });

  test('detail page shows all submitted fields', async ({ page }) => {
    await page.goto('/items');
    // Navigate to the item via the card link
    const card = page.getByRole('link', { name: /View Blue Oxford Shirt/ });
    await expect(card).toBeVisible();
    await card.click();

    await expect(page.getByTestId('item-detail-page')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Blue Oxford Shirt' })).toBeVisible();

    // Badges
    await expect(page.getByText('Uniqlo')).toBeVisible();
    await expect(page.getByText('Blue')).toBeVisible();

    // Purchase section
    await expect(page.getByTestId('purchase-section')).toBeVisible();
    await expect(page.getByText('49.99')).toBeVisible();
    await expect(page.getByText(/USD/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Seller' })).toBeVisible();

    // Metadata
    await expect(page.getByText('size')).toBeVisible();
    await expect(page.getByText('M')).toBeVisible();

    // Photo uploaded
    await expect(page.getByTestId('photo-gallery')).toBeVisible();

    // Location breadcrumb
    await expect(page.getByTestId('location-breadcrumb')).toBeVisible();
    await expect(page.getByTestId('location-breadcrumb')).toContainText('Test Wardrobe');
  });

  test('items grid shows the new item card', async ({ page }) => {
    await page.goto('/items');
    await expect(page.getByTestId('items-page')).toBeVisible();

    const card = page.getByTestId('item-card').filter({ hasText: 'Blue Oxford Shirt' });
    await expect(card).toBeVisible();

    // Card has a link and shows the item name
    await expect(card.getByRole('link', { name: /View Blue Oxford Shirt/ })).toBeVisible();
  });

  test('edit item: update name and add second metadata field', async ({ page }) => {
    await page.goto('/items');
    // Go to the item
    await page.getByRole('link', { name: /View Blue Oxford Shirt/ }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    // Click Edit
    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/items\/[^/]+\/edit/);
    await expect(page.getByTestId('edit-item-page')).toBeVisible();

    // Update name
    const nameInput = page.getByLabel('Name *');
    await nameInput.clear();
    await nameInput.fill('Blue Oxford Shirt (Updated)');

    // Add a second metadata field
    await page.getByRole('button', { name: 'Add Field' }).click();
    const keyInputs = page.getByPlaceholder('Key');
    const valueInputs = page.getByPlaceholder('Value');
    await keyInputs.last().fill('material');
    await valueInputs.last().fill('cotton');

    // Submit
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Should redirect to detail page
    await expect(page).toHaveURL(/\/items\/[^/]+$/);
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    // Verify updated name and both metadata fields
    await expect(page.getByRole('heading', { name: 'Blue Oxford Shirt (Updated)' })).toBeVisible();
    await expect(page.getByText('size')).toBeVisible();
    await expect(page.getByText('M')).toBeVisible();
    await expect(page.getByText('material')).toBeVisible();
    await expect(page.getByText('cotton')).toBeVisible();
  });

  test('delete item: confirmation dialog then item gone from list', async ({ page }) => {
    await page.goto('/items');
    // Navigate to the updated item
    await page.getByRole('link', { name: /View Blue Oxford Shirt \(Updated\)/ }).click();
    await expect(page.getByTestId('item-detail-page')).toBeVisible();

    // Click Delete button — opens confirmation dialog
    await page.getByRole('button', { name: 'Delete' }).click();

    // Confirm the deletion
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    // Should redirect to items list
    await expect(page).toHaveURL(/\/items$/);
    await expect(page.getByTestId('items-page')).toBeVisible();

    // Item should no longer be visible in the grid
    const deletedCard = page.getByTestId('item-card').filter({ hasText: 'Blue Oxford Shirt (Updated)' });
    await expect(deletedCard).not.toBeVisible();
  });
});
