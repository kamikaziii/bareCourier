import { test, expect, loginAsClient } from './fixtures';

test.describe('Phase 5: Client Experience', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsClient(page);
	});

	test('client sees dashboard heading', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'My Services' })).toBeVisible();
	});

	test('client can see filter buttons', async ({ page }) => {
		await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Tomorrow' })).toBeVisible();
	});

	test('new request page loads', async ({ page }) => {
		await page.getByRole('link', { name: 'New Request' }).click();
		await expect(page).toHaveURL(/\/en\/client\/new/);
		await expect(page.getByRole('heading', { name: 'New Service Request' })).toBeVisible();
	});

	test('new request form has required fields', async ({ page }) => {
		await page.goto('/en/client/new');
		await expect(page.getByText('Pickup Location')).toBeVisible();
		await expect(page.getByText('Delivery Location')).toBeVisible();
	});

	test('client service detail loads', async ({ page }) => {
		const serviceLink = page.locator('a[href*="/en/client/services/"]').first();
		if (await serviceLink.isVisible({ timeout: 5000 }).catch(() => false)) {
			await serviceLink.click();
			await expect(page).toHaveURL(/\/en\/client\/services\/.+/);
		}
	});
});
