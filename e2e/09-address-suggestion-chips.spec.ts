import { test, expect } from '@playwright/test';
import { loginAsClient } from './fixtures';

test.describe('Phase 9: Address Suggestion Chips', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsClient(page);
		await expect(page).toHaveURL(/\/en\/client/);
	});

	test('9.1 Pickup chips appear from service history', async ({ page }) => {
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		await expect(page.getByRole('heading', { name: 'New Service Request' })).toBeVisible();

		// Pickup chips container: sibling of the input wrapper, inside AddressInput's space-y-1
		// The chips are buttons inside a flex-wrap container below the #pickup input
		const pickupSection = page.locator('#pickup').locator('..').locator('..');
		const pickupChips = pickupSection.locator('button[type="button"][aria-pressed]');

		// At least one chip should be visible (the default "Rua Augusta" address)
		await expect(pickupChips.first()).toBeVisible({ timeout: 5000 });

		const chipCount = await pickupChips.count();
		expect(chipCount).toBeGreaterThanOrEqual(1);
		expect(chipCount).toBeLessThanOrEqual(3);

		// The default chip should have a Home icon (svg element inside the button)
		const defaultChip = pickupChips.filter({ has: page.locator('svg') }).first();
		await expect(defaultChip).toBeVisible();

		// All chips start unselected
		for (let i = 0; i < chipCount; i++) {
			await expect(pickupChips.nth(i)).toHaveAttribute('aria-pressed', 'false');
		}
	});

	test('9.2 Delivery chips appear from service history', async ({ page }) => {
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		const deliverySection = page.locator('#delivery').locator('..').locator('..');
		const deliveryChips = deliverySection.locator('button[type="button"][aria-pressed]');

		// Should have at least one delivery chip from past "Avenida da Liberdade" deliveries
		await expect(deliveryChips.first()).toBeVisible({ timeout: 5000 });

		const chipCount = await deliveryChips.count();
		expect(chipCount).toBeGreaterThanOrEqual(1);
		expect(chipCount).toBeLessThanOrEqual(3);

		// Delivery chips should NOT have Home icon (only pickup default gets it)
		const chipsWithHomeIcon = deliveryChips.filter({ has: page.locator('svg') });
		await expect(chipsWithHomeIcon).toHaveCount(0);
	});

	test('9.3 Clicking a chip fills the input', async ({ page }) => {
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		const pickupInput = page.locator('#pickup');
		const pickupSection = pickupInput.locator('..').locator('..');
		const pickupChips = pickupSection.locator('button[type="button"][aria-pressed]');

		await expect(pickupChips.first()).toBeVisible({ timeout: 5000 });

		// Get the chip's address from its aria-label (full address is in the label)
		// For default chip: "Default: Rua Augusta..." — for others just the address
		const firstChip = pickupChips.first();
		await firstChip.click();

		// Input should now have a non-empty value
		const inputValue = await pickupInput.inputValue();
		expect(inputValue.length).toBeGreaterThan(0);

		// The hint text should change to "verified" (confirming address has coordinates)
		const verifiedHint = pickupSection.getByText('Address verified', { exact: false });
		await expect(verifiedHint).toBeVisible({ timeout: 2000 });
	});

	test('9.4 aria-pressed reflects chip selection state', async ({ page }) => {
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		const pickupSection = page.locator('#pickup').locator('..').locator('..');
		const pickupChips = pickupSection.locator('button[type="button"][aria-pressed]');

		await expect(pickupChips.first()).toBeVisible({ timeout: 5000 });

		const chipCount = await pickupChips.count();

		// Click the first chip
		await pickupChips.first().click();
		await expect(pickupChips.first()).toHaveAttribute('aria-pressed', 'true');

		// All other chips should be false
		for (let i = 1; i < chipCount; i++) {
			await expect(pickupChips.nth(i)).toHaveAttribute('aria-pressed', 'false');
		}

		// If there's a second chip, click it — first should deselect
		if (chipCount > 1) {
			await pickupChips.nth(1).click();
			await expect(pickupChips.nth(1)).toHaveAttribute('aria-pressed', 'true');
			await expect(pickupChips.first()).toHaveAttribute('aria-pressed', 'false');
		}
	});

	test('9.5 Typing in input clears chip selection', async ({ page }) => {
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		const pickupInput = page.locator('#pickup');
		const pickupSection = pickupInput.locator('..').locator('..');
		const pickupChips = pickupSection.locator('button[type="button"][aria-pressed]');

		await expect(pickupChips.first()).toBeVisible({ timeout: 5000 });

		// Select a chip first
		await pickupChips.first().click();
		await expect(pickupChips.first()).toHaveAttribute('aria-pressed', 'true');

		// Type in the input — this should clear the chip selection
		await pickupInput.fill('something else');

		// All chips should now be unselected (value no longer matches any chip address)
		const chipCount = await pickupChips.count();
		for (let i = 0; i < chipCount; i++) {
			await expect(pickupChips.nth(i)).toHaveAttribute('aria-pressed', 'false');
		}
	});

	test('9.6 Delivery chip selection works independently', async ({ page }) => {
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		const deliveryInput = page.locator('#delivery');
		const deliverySection = deliveryInput.locator('..').locator('..');
		const deliveryChips = deliverySection.locator('button[type="button"][aria-pressed]');

		await expect(deliveryChips.first()).toBeVisible({ timeout: 5000 });

		// Click the first delivery chip
		await deliveryChips.first().click();

		// Delivery input should be filled
		const inputValue = await deliveryInput.inputValue();
		expect(inputValue.length).toBeGreaterThan(0);

		// Chip should be selected
		await expect(deliveryChips.first()).toHaveAttribute('aria-pressed', 'true');

		// Verify the hint shows verified state
		const verifiedHint = deliverySection.getByText('Address verified', { exact: false });
		await expect(verifiedHint).toBeVisible({ timeout: 2000 });
	});
});
