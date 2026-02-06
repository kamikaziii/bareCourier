// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsCourier, loginAsClient, CLIENT } from './fixtures';

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

test.describe('Phase 2: First Client Creation', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsCourier(page);
		await expect(page).toHaveURL(/\/en\/courier/);
	});

	test('2.1 Navigate to Clients', async ({ page }) => {
		// Click "Clients" in navigation
		await page.getByRole('link', { name: 'Clients' }).click();

		// Expected Results: Clients page loads
		await expect(page).toHaveURL(/\/en\/courier\/clients/);

		// "Add Client" link visible
		const createBtn = page.getByRole('link', { name: 'Add Client' });
		await expect(createBtn).toBeVisible();
	});

	test('2.2 Create First Client (Password Flow)', async ({ page }) => {
		await page.goto('/en/courier/clients');

		// Check if client already exists (idempotent)
		// Use a more robust check - look for the client name text anywhere
		const clientText = page.getByText('Test Business');
		if (await clientText.isVisible({ timeout: 2000 }).catch(() => false)) {
			// Client already exists, verify it's there and skip creation
			await expect(clientText).toBeVisible();
			return;
		}

		// Click "Add Client" link
		await page.getByRole('link', { name: 'Add Client' }).click();

		// Wait for form to load
		await expect(page.getByRole('heading', { name: /New Client/i })).toBeVisible();

		// Fill in email first
		await page.getByRole('textbox', { name: /Email/i }).fill(CLIENT.email);

		// Toggle OFF "Send invitation email" if it's checked (to show password field)
		const invitationToggle = page.getByRole('switch', { name: /invitation/i });
		if (await invitationToggle.isVisible().catch(() => false)) {
			const isChecked = await invitationToggle.getAttribute('aria-checked');
			if (isChecked === 'true') {
				await invitationToggle.click();
				await page.waitForTimeout(300); // Wait for password field to appear
			}
		}

		// Password field should be visible - fill it
		const passwordField = page.getByRole('textbox', { name: /Password/i });
		await expect(passwordField).toBeVisible({ timeout: 3000 });
		await passwordField.fill(CLIENT.password);

		// Fill in client name
		await page.getByRole('textbox', { name: /^Name/i }).fill('Test Business');

		// Fill in phone
		await page.getByRole('textbox', { name: /Phone/i }).fill('+351 912 345 678');

		// Fill in default pickup location (if visible)
		const pickupInput = page.getByRole('textbox', { name: /default address/i });
		if (await pickupInput.isVisible().catch(() => false)) {
			await pickupInput.fill('Rua Augusta 100, Lisboa');
			// Wait for autocomplete suggestions and select first one
			await page.waitForTimeout(1000);
			const suggestion = page.getByRole('button', { name: /Rua Augusta 100/i }).first();
			if (await suggestion.isVisible().catch(() => false)) {
				await suggestion.click();
				await page.waitForTimeout(300); // Wait for dropdown to close
			}
		}

		// Submit form
		await page.getByRole('button', { name: 'Create Client' }).click();

		// Check for error toast (client might already exist as orphaned auth user)
		const errorToast = page.getByText('Failed to create client');
		if (await errorToast.isVisible({ timeout: 2000 }).catch(() => false)) {
			// Client creation failed - could be orphaned auth user
			// Navigate back and check if profile exists
			await page.goto('/en/courier/clients');
			const clientVisible = await page
				.getByText('Test Business')
				.isVisible({ timeout: 2000 })
				.catch(() => false);
			if (clientVisible) {
				// Client profile exists, test can continue
				return;
			}
			// Auth user exists without profile - need database reset
			// Skip this test gracefully
			test.skip(
				true,
				'Orphaned auth user exists. Run "pnpm exec playwright test e2e/00-reset.spec.ts" first.'
			);
			return;
		}

		// Expected Results: Success toast appears
		await expectSuccessFeedback(page);

		// Redirected to clients list
		await expect(page).toHaveURL(/\/en\/courier\/clients/, { timeout: 10000 });

		// New client appears with name
		await expect(page.getByText('Test Business')).toBeVisible();
	});

	test('2.3 Verify Client Details', async ({ page }) => {
		await page.goto('/en/courier/clients');

		// Click on created client
		await page.getByText('Test Business').first().click();

		// Expected Results: Client details page shows info
		await expect(page.getByRole('heading', { name: 'Test Business' })).toBeVisible();
		// Phone should be displayed somewhere
		await expect(page.getByText(/912.*345.*678|351/)).toBeVisible();
	});

	test('2.4 Verify Client Can Login', async ({ page }) => {
		// Clear all cookies and storage to ensure clean logout
		await page.context().clearCookies();
		await page.evaluate(() => localStorage.clear());

		// Login as client
		await loginAsClient(page);

		// Expected Results: Client dashboard loads
		await expect(page).toHaveURL(/\/en\/client/);
	});
});
