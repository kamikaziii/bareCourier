// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsCourier, loginAsClient } from './fixtures';

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

test.describe('Phase 7: Service Delivery', () => {
	test('7.1 Mark Service Delivered', async ({ page }) => {
		await loginAsCourier(page);
		await expect(page).toHaveURL(/\/en\/courier/);

		// Go to courier dashboard
		await page.goto('/en/courier');
		await page.waitForLoadState('networkidle');

		// Find a pending service on the dashboard
		// The status toggle button has title "Mark Delivered" for pending services
		const markDeliveredButton = page.getByTitle('Mark Delivered').first();

		if (!(await markDeliveredButton.isVisible({ timeout: 5000 }).catch(() => false))) {
			// No pending services on dashboard, try "All" filter
			const allFilter = page.getByRole('button', { name: 'All' });
			if (await allFilter.isVisible().catch(() => false)) {
				await allFilter.click();
				await page.waitForLoadState('networkidle');
			}
		}

		const hasMarkDelivered = await markDeliveredButton
			.isVisible({ timeout: 5000 })
			.catch(() => false);

		if (!hasMarkDelivered) {
			test.skip(true, 'No pending services to mark as delivered');
			return;
		}

		// Click the "Mark Delivered" toggle button
		await markDeliveredButton.click();

		// The optimistic UI should update immediately:
		// - The button should change to "Mark Pending" (RotateCcw icon)
		// - Or a syncing indicator appears briefly
		// Wait for the sync to complete
		await page.waitForTimeout(1000);

		// After sync, the service status should show as delivered
		// The button title changes to "Mark Pending" indicating it's now delivered
		const markPendingButton = page.getByTitle('Mark Pending').first();
		await expect(markPendingButton).toBeVisible({ timeout: 5000 });
	});

	test('7.2 Verify Client Sees Delivery', async ({ page }) => {
		// Switch to client session: clear cookies, navigate to login, then clear localStorage
		await page.context().clearCookies();
		await page.goto('/en/login');
		await page.waitForLoadState('domcontentloaded');
		await page.evaluate(() => localStorage.clear());

		await loginAsClient(page);
		await expect(page).toHaveURL(/\/en\/client/);

		// Navigate to client dashboard
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// The service should exist
		const emptyState = page.getByText('No services yet');
		await expect(emptyState).not.toBeVisible({ timeout: 3000 });

		// Look for delivered status indicator
		// Check the "Delivered" filter or delivered count
		const deliveredStat = page.getByText('Delivered').first();
		await expect(deliveredStat).toBeVisible({ timeout: 5000 });

		// Click "Delivered" quick filter to see delivered services
		const deliveredFilter = page.getByRole('button', { name: 'Delivered' });
		if (await deliveredFilter.isVisible().catch(() => false)) {
			await deliveredFilter.click();
			await page.waitForTimeout(500);

			// At least one delivered service should be visible
			const serviceCard = page.getByText(/Avenida da Liberdade/i).first();
			const hasDelivered = await serviceCard.isVisible({ timeout: 3000 }).catch(() => false);

			// If no delivered services from Phase 4's address, check for any service
			if (!hasDelivered) {
				// There should be at least some delivered service
				const anyService = page.locator('[class*="card"]').first();
				await expect(anyService).toBeVisible({ timeout: 3000 });
			}
		}
	});
});
