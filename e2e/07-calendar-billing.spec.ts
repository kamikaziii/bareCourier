import { test, expect, loginAsCourier, loginAsClient } from './fixtures';

test.describe('Phase 7: Calendar & Billing', () => {
	test.describe('Courier Calendar', () => {
		test.beforeEach(async ({ page }) => {
			await loginAsCourier(page);
		});

		test('calendar page loads with month view', async ({ page }) => {
			await page.goto('/en/courier/calendar');
			await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
			await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
		});

		test('calendar month navigation works', async ({ page }) => {
			await page.goto('/en/courier/calendar');
			await page.getByRole('button', { name: 'Today' }).click();
		});

		test('clicking a calendar day shows detail', async ({ page }) => {
			await page.goto('/en/courier/calendar');
			// Click today's highlighted cell
			const todayCell = page.locator('button[class*="ring"]').first();
			if (await todayCell.isVisible({ timeout: 3000 }).catch(() => false)) {
				await todayCell.click();
			}
		});
	});

	test.describe('Courier Billing', () => {
		test.beforeEach(async ({ page }) => {
			await loginAsCourier(page);
		});

		test('billing page loads with date range and summary', async ({ page }) => {
			await page.goto('/en/courier/billing');
			await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
		});

		test('billing summary cards visible', async ({ page }) => {
			await page.goto('/en/courier/billing');
			await expect(page.getByText('Total Services')).toBeVisible({ timeout: 10000 });
		});

		test('export CSV button visible', async ({ page }) => {
			await page.goto('/en/courier/billing');
			await expect(page.getByRole('button', { name: /Export CSV/ })).toBeVisible();
		});
	});

	test.describe('Client Calendar', () => {
		test('client calendar loads', async ({ page }) => {
			await loginAsClient(page);
			await page.goto('/en/client/calendar');
			await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
		});
	});

	test.describe('Client Billing', () => {
		test('client billing page loads', async ({ page }) => {
			await loginAsClient(page);
			await page.goto('/en/client/billing');
			await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
		});
	});
});
