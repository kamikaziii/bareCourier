// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsCourier } from './fixtures';

// Helper to navigate to a settings tab reliably
// Waits for full hydration before clicking tabs
async function goToSettingsTab(page: Page, tabName: string) {
	await page.goto('/en/courier/settings');
	// Wait for network idle to ensure Svelte hydration is complete
	await page.waitForLoadState('networkidle');
	// Now click the target tab
	if (tabName !== 'Account') {
		await page.getByRole('tab', { name: tabName }).click();
	}
}

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	// All settings use sonner toasts with [data-sonner-toast]
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

// Helper to check if a service type exists
async function serviceTypeExists(page: Page, name: string): Promise<boolean> {
	const heading = page.getByRole('heading', { name, level: 4 });
	return heading.isVisible({ timeout: 1000 }).catch(() => false);
}

// Helper to create a service type if it doesn't already exist
async function createServiceTypeIfNeeded(
	page: Page,
	name: string,
	price: string
): Promise<boolean> {
	// Check if it already exists
	if (await serviceTypeExists(page, name)) {
		return false; // Already exists, no need to create
	}

	// Click "Add Type" button
	await page.getByRole('button', { name: 'Add Type' }).click();
	await page.waitForTimeout(300);

	// Fill in the form
	await page.getByPlaceholder('e.g., Dental').fill(name);
	await page.getByRole('spinbutton', { name: 'Price', exact: true }).fill(price);

	// Click Save in the dialog (the button group that also has Cancel)
	await page
		.getByRole('button', { name: 'Cancel' })
		.locator('..')
		.getByRole('button', { name: 'Save', exact: true })
		.click();

	return true; // Created
}

test.describe('Phase 1: Courier Onboarding', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsCourier(page);
		await expect(page).toHaveURL(/\/en\/courier/);
	});

	test('1.1 Account Setup', async ({ page }) => {
		await goToSettingsTab(page, 'Account');

		// Verify Account tab is active
		const accountTab = page.getByRole('tab', { name: 'Account' });
		await expect(accountTab).toBeVisible();

		// Fill in courier name (use exact match to avoid matching "Business Name")
		await page.getByRole('textbox', { name: 'Name Name' }).fill('Test Courier');

		// Fill in phone number
		await page.getByRole('textbox', { name: 'Phone Phone' }).fill('+351 912 345 678');

		// Click the first Save button (Profile section)
		await page.getByRole('button', { name: 'Save', exact: true }).first().click();

		// Expected Results: Toast with "Profile updated" appears
		await expect(page.getByText('Profile updated')).toBeVisible({ timeout: 10000 });
	});

	test('1.2 Select Type-Based Pricing Model', async ({ page }) => {
		await goToSettingsTab(page, 'Pricing');

		const pricingContent = page.getByText('Distance Calculation Mode').first();
		await expect(pricingContent).toBeVisible({ timeout: 5000 });

		// Check if Type-based pricing is already selected
		const typeBasedRadio = page.getByRole('radio', { name: /Type-based pricing/i });
		const isChecked = await typeBasedRadio.isChecked();

		if (!isChecked) {
			// Click to select Type-based pricing
			await typeBasedRadio.click();
		}

		// Click the first Save button on the page (belongs to Distance Calculation Mode section)
		await page.getByRole('button', { name: 'Save', exact: true }).first().click();

		// Expected Results: Success feedback appears
		await expectSuccessFeedback(page);

		// Expected Results: Service Types section becomes available (use first match)
		await expect(page.getByText('Service Types').first()).toBeVisible();
	});

	test('1.3 Create Service Types', async ({ page }) => {
		await goToSettingsTab(page, 'Pricing');

		// Wait for Pricing tab content (use first match - desktop/mobile duplicate)
		await expect(page.getByText('Service Types').first()).toBeVisible();

		// Create service types if they don't already exist (idempotent)
		const createdStandard = await createServiceTypeIfNeeded(page, 'Standard Delivery', '5');
		if (createdStandard) {
			await expectSuccessFeedback(page);
			await page.waitForTimeout(4500);
		}

		const createdExpress = await createServiceTypeIfNeeded(page, 'Express Delivery', '10');
		if (createdExpress) {
			await expectSuccessFeedback(page);
			await page.waitForTimeout(4500);
		}

		const createdSameDay = await createServiceTypeIfNeeded(page, 'Same Day', '15');
		if (createdSameDay) {
			await expectSuccessFeedback(page);
		}

		// Expected Results: Three service types appear in list
		await expect(page.getByRole('heading', { name: 'Standard Delivery', level: 4 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Express Delivery', level: 4 })).toBeVisible();
		await expect(page.getByRole('heading', { name: 'Same Day', level: 4 })).toBeVisible();
	});

	test('1.4 Create Distribution Zones', async ({ page }) => {
		await goToSettingsTab(page, 'Pricing');

		// Verify Distribution Zones section is visible (use first match - desktop/mobile duplicate)
		await expect(page.getByText('Distribution Zones').first()).toBeVisible();

		// Expand Lisboa district and select it
		await page.getByRole('checkbox', { name: 'Select all Lisboa' }).check();

		// Save changes - the last Save button on the page is for Distribution Zones
		await page.getByRole('button', { name: 'Save', exact: true }).last().click();

		// Expected Results: Success feedback appears
		await expectSuccessFeedback(page);
	});

	test('1.5 Configure VAT', async ({ page }) => {
		await goToSettingsTab(page, 'Pricing');

		// Wait for VAT section to be visible
		await expect(page.getByText('I charge VAT').first()).toBeVisible();

		// Find all switches on the page - the VAT switches are in the VAT section
		const allSwitches = page.getByRole('switch');

		// First switch in VAT section is "I charge VAT"
		const vatSwitch = allSwitches.first();

		// Enable VAT if not already enabled
		const isVatEnabled = await vatSwitch.getAttribute('aria-checked');
		if (isVatEnabled !== 'true') {
			await vatSwitch.click();
		}

		// Set rate to 23%
		await page.getByRole('spinbutton', { name: /VAT rate/i }).fill('23');

		// Second switch is "My prices already include VAT"
		const includesVatSwitch = allSwitches.nth(1);
		const includesVat = await includesVatSwitch.getAttribute('aria-checked');
		if (includesVat !== 'true') {
			await includesVatSwitch.click();
		}

		// Save VAT settings - find Save buttons and use appropriate index
		// On Pricing tab with type-based pricing: Service Types Save, Distribution Zones Save, VAT Save
		const saveButtons = page.getByRole('button', { name: 'Save', exact: true });
		await saveButtons.nth(2).click(); // VAT Save is 3rd button (index 2)

		// Expected Results: Success feedback appears
		await expectSuccessFeedback(page);
	});

	test('1.6 Configure Time Slots', async ({ page }) => {
		await goToSettingsTab(page, 'Scheduling');

		const schedulingPanel = page.getByRole('tabpanel', { name: 'Scheduling' });
		await expect(schedulingPanel).toBeVisible({ timeout: 5000 });

		// Set morning slot (08:00-12:00)
		await schedulingPanel.locator('input[name="morning_start"]').fill('08:00');
		await schedulingPanel.locator('input[name="morning_end"]').fill('12:00');

		// Set afternoon slot (12:00-17:00)
		await schedulingPanel.locator('input[name="afternoon_start"]').fill('12:00');
		await schedulingPanel.locator('input[name="afternoon_end"]').fill('17:00');

		// Set evening slot (17:00-20:00)
		await schedulingPanel.locator('input[name="evening_start"]').fill('17:00');
		await schedulingPanel.locator('input[name="evening_end"]').fill('20:00');

		// Save time slots - find the first Save button in the panel
		await schedulingPanel.getByRole('button', { name: 'Save', exact: true }).first().click();

		// Verify success toast
		let toast = page.locator('[data-sonner-toast]');
		await expect(toast).toBeVisible({ timeout: 5000 });
		await page.waitForTimeout(4500);

		// Configure working days (Mon-Fri)
		// These are checkboxes that we need to ensure are checked
		const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
		for (const day of days) {
			const checkbox = schedulingPanel.getByRole('checkbox', { name: day });
			if (!(await checkbox.isChecked())) {
				await checkbox.check();
			}
		}

		// Save working days - get all Save buttons in the panel and select the second one (index 1)
		await schedulingPanel.getByRole('button', { name: 'Save', exact: true }).nth(1).click();

		// Expected Results: Success toast appears
		toast = page.locator('[data-sonner-toast]');
		await expect(toast).toBeVisible({ timeout: 5000 });
	});

	test('1.7 Configure Notifications', async ({ page }) => {
		await goToSettingsTab(page, 'Notifications');

		// Wait for Notifications tab content
		const notifContent = page.getByText('Notification Preferences').first();
		await expect(notifContent).toBeVisible({ timeout: 5000 });

		// Note: In-app notifications are always enabled
		// This test verifies the page loads and can be saved

		// Click the first Save button on the page (belongs to Notification Preferences)
		await page.getByRole('button', { name: 'Save', exact: true }).first().click();

		// Expected Results: Success toast appears
		const toast = page.locator('[data-sonner-toast]');
		await expect(toast).toBeVisible({ timeout: 5000 });
	});
});
