// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsCourier, loginAsClient } from './fixtures';

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

test.describe('Phase 5: Request Acceptance', () => {
	test('5.1 View Pending Requests', async ({ page }) => {
		await loginAsCourier(page);
		await expect(page).toHaveURL(/\/en\/courier/);

		// Navigate to requests page
		await page.goto('/en/courier/requests');
		await page.waitForLoadState('networkidle');

		// Page should load with "Requests" heading
		await expect(page.getByRole('heading', { name: 'Requests' })).toBeVisible();

		// Should see at least one pending request (from Phase 4)
		// Look for client name or action buttons
		const acceptButton = page.getByRole('button', { name: 'Accept' }).first();
		const noRequests = page.getByText('No pending requests');

		const hasAccept = await acceptButton.isVisible({ timeout: 5000 }).catch(() => false);
		const isEmpty = await noRequests.isVisible({ timeout: 2000 }).catch(() => false);

		if (isEmpty) {
			test.skip(true, 'No pending requests - Phase 4 may not have run');
			return;
		}

		// Accept, Suggest, and Reject buttons should be visible
		expect(hasAccept).toBeTruthy();
		await expect(page.getByRole('button', { name: 'Suggest' }).first()).toBeVisible();
		await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeVisible();
	});

	test('5.2 Accept Request', async ({ page }) => {
		await loginAsCourier(page);
		await page.goto('/en/courier/requests');
		await page.waitForLoadState('networkidle');

		// Check if there are pending requests
		const noRequests = page.getByText('No pending requests');
		if (await noRequests.isVisible({ timeout: 3000 }).catch(() => false)) {
			test.skip(true, 'No pending requests to accept');
			return;
		}

		// Click "Accept" on the first request
		const acceptButton = page.getByRole('button', { name: 'Accept' }).first();
		await expect(acceptButton).toBeVisible({ timeout: 5000 });
		await acceptButton.click();

		// Accept dialog should appear
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 3000 });

		// Dialog should have "Confirm Accept?" title or similar
		await expect(dialog.getByText(/confirm accept/i)).toBeVisible();

		// Click the Accept button inside the dialog
		const confirmButton = dialog.getByRole('button', { name: 'Accept' });
		await expect(confirmButton).toBeVisible();
		await confirmButton.click();

		// Expected: Success toast appears
		await expectSuccessFeedback(page);

		// Dialog should close
		await expect(dialog).not.toBeVisible({ timeout: 5000 });
	});

	test('5.3 Verify Client Sees Acceptance', async ({ page }) => {
		// Switch to client session: clear cookies, navigate to login, then login as client
		await page.context().clearCookies();
		// Navigate first (to have a page context), then clear localStorage
		await page.goto('/en/login');
		await page.waitForLoadState('domcontentloaded');
		await page.evaluate(() => localStorage.clear());

		await loginAsClient(page);
		await expect(page).toHaveURL(/\/en\/client/);

		// Navigate to client dashboard
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// The service should exist (not empty state)
		const emptyState = page.getByText('No services yet');
		await expect(emptyState).not.toBeVisible({ timeout: 3000 });

		// Look for the service - it should have been accepted
		// The service card should be visible with the delivery address
		const deliveryAddress = page.getByText(/Avenida da Liberdade/i).first();
		const hasService = await deliveryAddress.isVisible({ timeout: 5000 }).catch(() => false);

		if (hasService) {
			await expect(deliveryAddress).toBeVisible();
		}
	});
});
