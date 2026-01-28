import { test, expect, loginAsCourier } from './fixtures';

test.describe('Phase 6: Request Negotiation', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsCourier(page);
	});

	test('courier requests page loads', async ({ page }) => {
		await page.goto('/en/courier/requests');
		await expect(page.getByRole('heading', { name: /Requests/ })).toBeVisible();
	});

	test('requests page shows pending count or empty state', async ({ page }) => {
		await page.goto('/en/courier/requests');
		const hasRequests = await page.getByText(/pending request/).isVisible({ timeout: 5000 }).catch(() => false);
		const isEmpty = await page.getByText('No pending requests').isVisible({ timeout: 5000 }).catch(() => false);
		expect(hasRequests || isEmpty).toBe(true);
	});

	test('request cards show action buttons when present', async ({ page }) => {
		await page.goto('/en/courier/requests');
		const acceptBtn = page.getByRole('button', { name: 'Accept' }).first();
		if (await acceptBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
			await expect(page.getByRole('button', { name: 'Suggest' }).first()).toBeVisible();
			await expect(page.getByRole('button', { name: 'Reject' }).first()).toBeVisible();
		}
	});
});
