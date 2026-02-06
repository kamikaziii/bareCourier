// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsClient } from './fixtures';

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

test.describe('Phase 4: Client First Request', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsClient(page);
		await expect(page).toHaveURL(/\/en\/client/);
	});

	test('4.1 Client Dashboard (Initial State)', async ({ page }) => {
		// Navigate to client dashboard
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// Dashboard loads with "My Services" heading
		await expect(page.getByRole('heading', { name: 'My Services' })).toBeVisible();

		// "New Request" button should be visible (either in header or empty state)
		const newRequestLink = page.getByRole('link', { name: 'New Request' });
		const firstRequestLink = page.getByRole('link', { name: 'Create your first request' });

		const hasNewRequest = await newRequestLink.first().isVisible().catch(() => false);
		const hasFirstRequest = await firstRequestLink.isVisible().catch(() => false);

		// At least one CTA to create a request should be visible
		expect(hasNewRequest || hasFirstRequest).toBeTruthy();
	});

	test('4.2 Create Service Request', async ({ page }) => {
		// Navigate to new request page
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		// Verify form loads
		await expect(page.getByRole('heading', { name: 'New Service Request' })).toBeVisible();

		// Step 1: Enter pickup address (may be pre-filled from client default)
		const pickupInput = page.locator('#pickup');
		const pickupValue = await pickupInput.inputValue();
		if (!pickupValue) {
			await pickupInput.fill('Rua Augusta 100, Lisboa');
			await page.waitForTimeout(1000);
			const pickupSuggestion = page.getByRole('button', { name: /Rua Augusta/i }).first();
			if (await pickupSuggestion.isVisible().catch(() => false)) {
				await pickupSuggestion.click();
				await page.waitForTimeout(300);
			}
		}

		// Step 2: Enter delivery address
		const deliveryInput = page.locator('#delivery');
		await deliveryInput.fill('Avenida da Liberdade 1, Lisboa');

		// Wait for autocomplete suggestions and select
		const deliverySuggestion = page.getByRole('button', { name: /Avenida da Liberdade/i }).first();
		await expect(deliverySuggestion).toBeVisible({ timeout: 8000 });
		await deliverySuggestion.click();

		// Wait for address to be processed
		await page.waitForTimeout(500);

		// Step 3: Add optional notes
		const notesField = page.locator('#notes');
		if (await notesField.isVisible().catch(() => false)) {
			await notesField.fill('Client test request - first delivery');
		}

		// Step 4: Submit the request
		const createButton = page.getByRole('button', { name: 'Create Request' });
		await createButton.scrollIntoViewIfNeeded();
		await expect(createButton).toBeEnabled({ timeout: 5000 });
		await createButton.click();

		// Wait for form submission — button changes to "Creating..." then redirects
		// Give extra time for server processing + email notification dispatch
		await expect(page).toHaveURL(/\/en\/client(?!\/new)/, { timeout: 30000 });
	});

	test('4.3 Verify Request in Dashboard', async ({ page }) => {
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// Request should appear in the service list
		// Look for pending status indicator or the delivery address
		const pendingText = page.getByText(/pending/i).first();
		const deliveryAddress = page.getByText(/Avenida da Liberdade/i).first();

		const hasPending = await pendingText.isVisible({ timeout: 5000 }).catch(() => false);
		const hasAddress = await deliveryAddress.isVisible({ timeout: 2000 }).catch(() => false);

		// At least one indicator that the request exists
		expect(hasPending || hasAddress).toBeTruthy();

		// The empty state should NOT be visible anymore
		const emptyState = page.getByText('No services yet');
		await expect(emptyState).not.toBeVisible();
	});
});
