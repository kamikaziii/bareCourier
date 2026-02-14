// spec: specs/address-book.md
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';
import { loginAsClient } from './fixtures';

test.describe('Phase 10: Client Address Book', () => {
	test('10.0 Clean up existing addresses', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');

		// Delete all existing addresses to ensure clean state
		for (let i = 0; i < 20; i++) {
			// Reload to get fresh state after each delete
			if (i > 0) {
				await page.goto('/en/client/address-book');
				await page.waitForLoadState('networkidle');
			}

			const card = page.locator('[class*="card"]').first();
			const hasCard = await card.isVisible({ timeout: 1500 }).catch(() => false);
			if (!hasCard) break;

			// Click delete (second icon button in the card)
			await card.getByRole('button').nth(1).click();
			const alertDialog = page.getByRole('alertdialog');
			await expect(alertDialog).toBeVisible();
			await alertDialog.getByRole('button', { name: 'Delete' }).click();
			await page.waitForTimeout(500);
		}

		// Final reload and verify empty state
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');
		await expect(page.getByText('No saved addresses yet')).toBeVisible({ timeout: 5000 });
	});

	test('10.1 Address book shows empty state', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');

		// Page title visible
		await expect(page.getByRole('heading', { name: 'Address Book' })).toBeVisible();

		// Empty state message
		await expect(page.getByText('No saved addresses yet')).toBeVisible();

		// Add button visible
		await expect(page.getByRole('button', { name: 'Add Address' })).toBeVisible();
	});

	test('10.2 Add a new address', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');

		// Click Add Address
		await page.getByRole('button', { name: 'Add Address' }).click();

		// Dialog opens
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Add Address')).toBeVisible();

		// Fill label
		await dialog.locator('#address-label').fill('Test Office');

		// Fill address with autocomplete
		const addressInput = dialog.locator('#address-address');
		await addressInput.fill('Rua Augusta 100, Lisboa');
		await page.waitForTimeout(1500); // Wait for Mapbox debounce + API

		// Select first suggestion
		const suggestion = page.getByRole('button', { name: /Rua Augusta/i }).first();
		await expect(suggestion).toBeVisible({ timeout: 8000 });
		await suggestion.click();
		await page.waitForTimeout(300);

		// Click Save
		await dialog.getByRole('button', { name: 'Save' }).click();

		// Toast confirmation
		await expect(page.getByText('Address saved')).toBeVisible({ timeout: 5000 });

		// Address appears in list
		await expect(page.getByText('Test Office')).toBeVisible();
		await expect(page.getByText(/Rua Augusta/i)).toBeVisible();

		// Empty state should be gone
		await expect(page.getByText('No saved addresses yet')).not.toBeVisible();
	});

	test('10.3 Add a second address', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');

		// First address should already exist
		await expect(page.getByText('Test Office')).toBeVisible();

		// Add second address
		await page.getByRole('button', { name: 'Add Address' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();

		await dialog.locator('#address-label').fill('Warehouse');
		const addressInput = dialog.locator('#address-address');
		await addressInput.fill('Avenida da Liberdade 1, Lisboa');
		await page.waitForTimeout(1500);

		const suggestion = page.getByRole('button', { name: /Avenida da Liberdade/i }).first();
		await expect(suggestion).toBeVisible({ timeout: 8000 });
		await suggestion.click();
		await page.waitForTimeout(300);

		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByText('Address saved')).toBeVisible({ timeout: 5000 });

		// Both addresses visible
		await expect(page.getByText('Test Office')).toBeVisible();
		await expect(page.getByText('Warehouse')).toBeVisible();
	});

	test('10.4 Edit an existing address', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');

		// Find the "Test Office" card and click its edit button
		// Cards contain the label text — find the edit button in the same row
		const testOfficeCard = page.locator('[class*="card"]', { hasText: 'Test Office' });
		await testOfficeCard.getByRole('button').first().click(); // First icon button = edit (Pencil)

		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText('Edit Address')).toBeVisible();

		// Label should be pre-filled
		const labelInput = dialog.locator('#address-label');
		await expect(labelInput).toHaveValue('Test Office');

		// Change the label
		await labelInput.clear();
		await labelInput.fill('Main Office');

		// Save
		await dialog.getByRole('button', { name: 'Save' }).click();
		await expect(page.getByText('Address updated')).toBeVisible({ timeout: 5000 });

		// Updated label visible, old one gone
		await expect(page.getByText('Main Office')).toBeVisible();
		await expect(page.getByText('Test Office')).not.toBeVisible();
	});

	test('10.5 Delete an address', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');

		// Find the "Warehouse" card and click its delete button (second icon button = Trash2)
		const warehouseCard = page.locator('[class*="card"]', { hasText: 'Warehouse' });
		const buttons = warehouseCard.getByRole('button');
		await buttons.nth(1).click(); // Second icon button = delete

		// AlertDialog confirmation
		const alertDialog = page.getByRole('alertdialog');
		await expect(alertDialog).toBeVisible();
		await expect(alertDialog.getByText('Delete Address')).toBeVisible();

		// Confirm delete
		await alertDialog.getByRole('button', { name: 'Delete' }).click();
		await expect(page.getByText('Address deleted')).toBeVisible({ timeout: 5000 });

		// Warehouse gone, Main Office remains
		await expect(page.getByText('Warehouse')).not.toBeVisible();
		await expect(page.getByText('Main Office')).toBeVisible();
	});

	test('10.6 Search filters addresses', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/address-book');
		await page.waitForLoadState('networkidle');

		// Should have "Main Office"
		await expect(page.getByText('Main Office')).toBeVisible();

		// Search for it
		const searchInput = page.getByPlaceholder('Search addresses...');
		await searchInput.fill('Main');
		await page.waitForTimeout(400); // Debounce 300ms + buffer

		// Main Office should still be visible
		await expect(page.getByText('Main Office')).toBeVisible();

		// Search for something that doesn't exist
		await searchInput.clear();
		await searchInput.fill('nonexistent');
		await page.waitForTimeout(400);

		await expect(page.getByText('No addresses found')).toBeVisible();

		// Clear search to restore state
		await searchInput.clear();
		await page.waitForTimeout(400);
		await expect(page.getByText('Main Office')).toBeVisible();
	});

	test('10.7 Picker shows saved addresses on new request form', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		// Click the address book picker button next to Pickup Location
		const pickerButton = page.getByRole('button', { name: 'Pick from address book' }).first();
		await expect(pickerButton).toBeVisible();
		await pickerButton.click();

		// Popover should show saved addresses
		await expect(page.getByText('Main Office')).toBeVisible({ timeout: 3000 });
	});

	test('10.8 Selecting address from picker fills form field', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		// Open pickup picker
		const pickerButton = page.getByRole('button', { name: 'Pick from address book' }).first();
		await pickerButton.click();
		await page.waitForTimeout(300);

		// Click "Main Office" in the popover
		const mainOfficeOption = page.locator('button', { hasText: 'Main Office' });
		await expect(mainOfficeOption).toBeVisible({ timeout: 3000 });
		await mainOfficeOption.click();

		// Pickup field should now be filled
		const pickupInput = page.locator('#pickup');
		await expect(pickupInput).not.toHaveValue('');
		const pickupValue = await pickupInput.inputValue();
		expect(pickupValue).toContain('Rua Augusta');
	});

	test('10.9 Save address from picker on new request form', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		// Fill delivery with a new address
		const deliveryInput = page.locator('#delivery');
		await deliveryInput.fill('Rua do Ouro 50, Lisboa');
		await page.waitForTimeout(1500);

		const suggestion = page.getByRole('button', { name: /Rua do Ouro/i }).first();
		await expect(suggestion).toBeVisible({ timeout: 8000 });
		await suggestion.click();
		await page.waitForTimeout(500);

		// Open delivery picker (second picker button)
		const deliveryPickerButton = page.getByRole('button', { name: 'Pick from address book' }).nth(1);
		await deliveryPickerButton.click();
		await page.waitForTimeout(300);

		// Click "Save this address"
		const saveLink = page.getByText('Save this address');
		await expect(saveLink).toBeVisible({ timeout: 3000 });
		await saveLink.click();

		// Fill the label
		const labelInput = page.getByPlaceholder(/John's Bakery|Padaria/i);
		await expect(labelInput).toBeVisible();
		await labelInput.fill('Client Warehouse');

		// Click the save icon button
		const saveButton = page.locator('button[type="submit"]').last();
		await saveButton.click();

		// Toast confirmation
		await expect(page.getByText('Address saved')).toBeVisible({ timeout: 5000 });
	});
});
