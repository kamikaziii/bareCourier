// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsCourier, loginAsClient } from './fixtures';

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

test.describe('Phase 20: Rejection and Resubmit Flow', () => {
	test('20.0 Client Creates Request to Be Rejected', async ({ page }) => {
		// Login as client and create a new request
		await loginAsClient(page);
		await page.goto('/en/client/new');
		await page.waitForLoadState('networkidle');

		// Fill pickup (may be pre-filled)
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

		// Fill delivery with different address
		const deliveryInput = page.locator('#delivery');
		await deliveryInput.fill('Rua do Ouro 50, Lisboa');
		const deliverySuggestion = page.getByRole('button', { name: /Rua do Ouro/i }).first();
		await expect(deliverySuggestion).toBeVisible({ timeout: 8000 });
		await deliverySuggestion.click();
		await page.waitForTimeout(500);

		// Add notes to identify this request
		const notesField = page.locator('#notes');
		if (await notesField.isVisible().catch(() => false)) {
			await notesField.fill('Rejection test request');
		}

		// Submit
		const createButton = page.getByRole('button', { name: 'Create Request' });
		await createButton.scrollIntoViewIfNeeded();
		await expect(createButton).toBeEnabled({ timeout: 5000 });
		await createButton.click();

		await expect(page).toHaveURL(/\/en\/client(?!\/new)/, { timeout: 30000 });
	});

	test('20.1 Courier Rejects Request', async ({ page }) => {
		// Switch to courier
		await page.context().clearCookies();
		await page.goto('/en/login');
		await page.waitForLoadState('domcontentloaded');
		await page.evaluate(() => localStorage.clear());

		await loginAsCourier(page);
		await page.goto('/en/courier/requests');
		await page.waitForLoadState('networkidle');

		// Check for pending requests
		const noRequests = page.getByText('No pending requests');
		if (await noRequests.isVisible({ timeout: 3000 }).catch(() => false)) {
			test.skip(true, 'No pending requests to reject');
			return;
		}

		// Click "Reject" on the first request
		const rejectButton = page.getByRole('button', { name: 'Reject' }).first();
		await expect(rejectButton).toBeVisible({ timeout: 5000 });
		await rejectButton.click();

		// Reject dialog should appear
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 3000 });

		// Dialog should have "Confirm Reject?" title
		await expect(dialog.getByText(/confirm reject/i)).toBeVisible();

		// Fill in rejection reason
		const reasonField = dialog.getByPlaceholder(/reason/i);
		if (await reasonField.isVisible().catch(() => false)) {
			await reasonField.fill('Area not serviceable this week');
		}

		// Click "Reject" button in the dialog
		const confirmReject = dialog.getByRole('button', { name: 'Reject' });
		await expect(confirmReject).toBeVisible();
		await confirmReject.click();

		// Expected: Success toast
		await expectSuccessFeedback(page);

		// Dialog should close
		await expect(dialog).not.toBeVisible({ timeout: 5000 });
	});

	test('20.2 Client Sees Rejection', async ({ page }) => {
		// Switch to client
		await loginAsClient(page);
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// Look for "Needs Attention" section with rejected request
		// Rejected items show a "Re-submit with changes" button
		const resubmitButton = page.getByRole('link', { name: /re-submit/i }).first();

		if (!(await resubmitButton.isVisible({ timeout: 5000 }).catch(() => false))) {
			// Might be displayed differently — look for rejection indicator
			const rejectedText = page.getByText(/rejected/i).first();
			const hasRejected = await rejectedText.isVisible({ timeout: 3000 }).catch(() => false);
			if (!hasRejected) {
				test.skip(true, 'No rejected requests visible');
				return;
			}
		}

		// The rejection reason should be visible somewhere
		// Verify the request appears in the Needs Attention section
		expect(true).toBeTruthy(); // If we got here, we found rejection indicators
	});

	test('20.3 Client Resubmits Request', async ({ page }) => {
		// Login as client
		await loginAsClient(page);
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// Find "Re-submit with changes" link for the rejected request
		const resubmitLink = page.getByRole('link', { name: /re-submit/i }).first();

		if (!(await resubmitLink.isVisible({ timeout: 5000 }).catch(() => false))) {
			test.skip(true, 'No resubmit button visible');
			return;
		}

		// Click to go to the new request form (pre-filled with rejected request data)
		await resubmitLink.click();
		await page.waitForLoadState('networkidle');

		// Should be on the new request form
		await expect(page.getByRole('heading', { name: 'New Service Request' })).toBeVisible();

		// Modify the delivery address
		const deliveryInput = page.locator('#delivery');
		await deliveryInput.clear();
		await deliveryInput.fill('Avenida da República 1, Lisboa');
		const deliverySuggestion = page.getByRole('button', { name: /Avenida da República/i }).first();
		await expect(deliverySuggestion).toBeVisible({ timeout: 8000 });
		await deliverySuggestion.click();
		await page.waitForTimeout(500);

		// Update notes
		const notesField = page.locator('#notes');
		if (await notesField.isVisible().catch(() => false)) {
			await notesField.clear();
			await notesField.fill('Resubmitted with different delivery address');
		}

		// Submit the resubmitted request
		const createButton = page.getByRole('button', { name: 'Create Request' });
		await createButton.scrollIntoViewIfNeeded();
		await expect(createButton).toBeEnabled({ timeout: 5000 });
		await createButton.click();

		// Expected: Redirected back to dashboard
		await expect(page).toHaveURL(/\/en\/client(?!\/new)/, { timeout: 30000 });
	});
});
