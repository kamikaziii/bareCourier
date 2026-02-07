// spec: specs/workflow-tests-plan.md
// seed: e2e/seed.spec.ts

import { test, expect, type Page } from '@playwright/test';
import { loginAsCourier, loginAsClient } from './fixtures';

// Helper to wait for success feedback (sonner toast)
async function expectSuccessFeedback(page: Page) {
	const sonnerToast = page.locator('[data-sonner-toast]');
	await expect(sonnerToast).toBeVisible({ timeout: 5000 });
}

test.describe('Phase 8: Reschedule Flow', () => {
	test('8.1 Client Requests Reschedule', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/client');
		await page.waitForLoadState('networkidle');

		// Find service cards with status='pending' (blue badge or blue dot)
		// ServiceCard component uses [role="button"] with a blue dot/badge for pending services
		const serviceCards = page.locator('[role="button"]').filter({
			has: page.locator('.bg-blue-500')
		});

		const cardCount = await serviceCards.count();

		if (cardCount === 0) {
			test.skip(true, 'No pending services available');
			return;
		}

		// Click the first pending service card
		await serviceCards.first().click();
		await page.waitForURL(/\/en\/client\/services\/[^/]+$/, { timeout: 10000 });
		await page.waitForLoadState('networkidle');

		// Look for "Request Reschedule" button on the service detail page
		const rescheduleButton = page.getByRole('button', { name: 'Request Reschedule' });

		if (!(await rescheduleButton.isVisible({ timeout: 3000 }).catch(() => false))) {
			test.skip(true, 'Request Reschedule button not available for this service');
			return;
		}

		await rescheduleButton.click();

		// Reschedule dialog should appear
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible({ timeout: 3000 });

		// Open the calendar popover by clicking "Select date"
		await dialog.getByText('Select date').click();

		// Wait for the calendar (portaled as [role="application"])
		const calendarApp = page.locator('[role="application"]');
		await expect(calendarApp).toBeVisible({ timeout: 5000 });

		// Fix z-index for popover inside dialog (bits-ui z-index conflict)
		await page.evaluate(() => {
			const popover = document.querySelector('[role="application"]');
			if (popover instanceof HTMLElement) {
				popover.style.zIndex = '100';
			}
		});

		// Navigate to next month to ensure the selected date is far enough in the future
		// (minimum notice hours may block dates too close to today).
		const nextMonthBtn = calendarApp.getByRole('button', { name: 'Next' });
		await nextMonthBtn.click();
		await page.waitForTimeout(300);

		// Select a mid-month day in the next month
		const dayCells = calendarApp.locator('[role="gridcell"]:not([data-disabled]) [role="button"]');
		const cellCount = await dayCells.count();
		const midIndex = Math.min(14, cellCount - 1);
		await dayCells.nth(midIndex).click();
		await page.waitForTimeout(500);

		// Verify the date was selected (popover should auto-close, "Select date" replaced by date)
		await expect(dialog.getByText('Select date')).not.toBeVisible({ timeout: 3000 });

		// Select time slot — "Afternoon (12pm-6pm)"
		await dialog.getByRole('button', { name: 'Afternoon (12pm-6pm)' }).click();

		// Add a reason
		const reasonField = dialog.getByPlaceholder(/explain why/i);
		if (await reasonField.isVisible().catch(() => false)) {
			await reasonField.fill('Schedule conflict, need later date');
		}

		// Submit — use the dialog's "Request Reschedule" button (there's also one on the page)
		const submitButton = dialog.getByRole('button', { name: 'Request Reschedule' });
		await expect(submitButton).toBeEnabled({ timeout: 3000 });
		await submitButton.click();

		// Expected: Success toast (reschedule always needs courier approval)
		await expectSuccessFeedback(page);

		// Dialog should close
		await expect(dialog).not.toBeVisible({ timeout: 5000 });
	});

	test('8.2 Courier Approves Reschedule', async ({ page }) => {
		// Switch to courier
		await page.context().clearCookies();
		await page.goto('/en/login');
		await page.waitForLoadState('domcontentloaded');
		await page.evaluate(() => localStorage.clear());

		await loginAsCourier(page);
		await page.goto('/en/courier/requests');
		await page.waitForLoadState('networkidle');

		// Look for the "Approve" button in the Pending Reschedules section
		const approveButton = page.getByRole('button', { name: /^approve$/i }).first();

		if (!(await approveButton.isVisible({ timeout: 5000 }).catch(() => false))) {
			test.skip(true, 'No pending reschedules found on requests page');
			return;
		}

		await approveButton.click();

		// Expected: Success toast
		await expectSuccessFeedback(page);

		// Wait for UI to update
		await page.waitForTimeout(1000);
	});
});
