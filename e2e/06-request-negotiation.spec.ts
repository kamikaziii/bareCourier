// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsCourier, loginAsClient } from './fixtures';

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

// Helper to switch from courier to client session
async function switchToClient(page: Page) {
	await page.context().clearCookies();
	await page.goto('/en/login');
	await page.waitForLoadState('domcontentloaded');
	await page.evaluate(() => localStorage.clear());
	await loginAsClient(page);
	await expect(page).toHaveURL(/\/en\/client/);
}

// Helper to switch from client to courier session
async function switchToCourier(page: Page) {
	await page.context().clearCookies();
	await page.goto('/en/login');
	await page.waitForLoadState('domcontentloaded');
	await page.evaluate(() => localStorage.clear());
	await loginAsCourier(page);
	await expect(page).toHaveURL(/\/en\/courier/);
}

test.describe('Phase 6: Request Negotiation', () => {
	test('6.0 Client Creates New Request for Negotiation', async ({ page }) => {
		// Login as client and create a new request for the courier to suggest on
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

		// Fill delivery
		const deliveryInput = page.locator('#delivery');
		await deliveryInput.fill('Praça do Comércio, Lisboa');
		const deliverySuggestion = page
			.getByRole('button', { name: /Praça do Comércio/i })
			.first();
		await expect(deliverySuggestion).toBeVisible({ timeout: 8000 });
		await deliverySuggestion.click();
		await page.waitForTimeout(500);

		// Add notes to identify this request
		const notesField = page.locator('#notes');
		if (await notesField.isVisible().catch(() => false)) {
			await notesField.fill('Negotiation test request');
		}

		// Submit
		const createButton = page.getByRole('button', { name: 'Create Request' });
		await createButton.scrollIntoViewIfNeeded();
		await expect(createButton).toBeEnabled({ timeout: 5000 });
		await createButton.click();

		await expect(page).toHaveURL(/\/en\/client(?!\/new)/, { timeout: 30000 });
	});

	test('6.1 Courier Suggests Alternative Date', async ({ page }) => {
		await loginAsCourier(page);
		await page.goto('/en/courier/requests');
		await page.waitForLoadState('networkidle');

		// Check for pending requests
		const noRequests = page.getByText('No pending requests');
		if (await noRequests.isVisible({ timeout: 3000 }).catch(() => false)) {
			test.skip(true, 'No pending requests to suggest on');
			return;
		}

		// Click "Suggest Alternative" on the first request
		const suggestButton = page.getByRole('button', { name: 'Suggest Alternative' }).first();
		await expect(suggestButton).toBeVisible({ timeout: 5000 });
		await suggestButton.click();

		// Suggest dialog should appear with "Suggest Alternative" title
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 3000 });

		// Use "Next compatible day" shortcut if available
		const useThisDate = dialog.getByRole('button', { name: 'Use this date' });
		if (await useThisDate.isVisible({ timeout: 2000 }).catch(() => false)) {
			await useThisDate.click();
			await page.waitForTimeout(300);
		} else {
			// Manually select a date — click "Select date" to open calendar
			const dateButton = dialog.getByRole('button', { name: /select date/i });
			await expect(dateButton).toBeVisible();
			await dateButton.click();
			await page.waitForTimeout(500);

			// Click an available future day in the calendar
			const calendarDays = page.locator(
				'[data-bits-calendar-cell]:not([data-disabled]):not([data-outside-month])'
			);
			const dayCount = await calendarDays.count();
			if (dayCount > 0) {
				await calendarDays.last().click();
			}
			await page.waitForTimeout(300);
		}

		// Select a time slot — "Morning (8am-12pm)"
		const morningSlot = dialog.getByRole('button', { name: 'Morning (8am-12pm)' });
		await expect(morningSlot).toBeVisible();
		await morningSlot.click();

		// Click "Send Suggestion" button
		const confirmButton = dialog.getByRole('button', { name: 'Send Suggestion' });
		await expect(confirmButton).toBeEnabled({ timeout: 3000 });
		await confirmButton.click();

		// Expected: Success toast
		await expectSuccessFeedback(page);

		// Dialog should close
		await expect(dialog).not.toBeVisible({ timeout: 5000 });
	});

	test('6.2 Client Responds to Suggestion (Accept)', async ({ page }) => {
		// Switch to client
		await loginAsClient(page);
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// Look for "Needs Attention" section with suggestion — "Respond" button
		const respondButton = page.getByRole('button', { name: 'Respond' }).first();

		if (!(await respondButton.isVisible({ timeout: 5000 }).catch(() => false))) {
			test.skip(true, 'No suggestions to respond to');
			return;
		}

		// Click "Respond" to open suggestion dialog
		await respondButton.click();

		// Wait for dialog with "Respond to Suggestion" title
		await expect(page.getByText('Respond to Suggestion')).toBeVisible({ timeout: 3000 });

		// Click "Accept" button in the dialog
		const acceptButton = page.getByRole('button', { name: 'Accept' });
		await expect(acceptButton).toBeVisible();
		await acceptButton.click();

		// Expected: Success toast
		await expectSuccessFeedback(page);
	});
});
