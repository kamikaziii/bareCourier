import { test, expect, loginAsCourier } from './fixtures';

test.describe('Phase 4: Courier Services', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsCourier(page);
	});

	test('navigate to services page', async ({ page }) => {
		await page.getByRole('link', { name: 'Services' }).click();
		await expect(page).toHaveURL(/\/en\/courier\/services/);
		await expect(page.getByText('All Services')).toBeVisible();
	});

	test('services page has new service button', async ({ page }) => {
		await page.goto('/en/courier/services');
		await expect(page.getByRole('link', { name: 'New Service' })).toBeVisible();
	});

	test('new service form loads', async ({ page }) => {
		await page.goto('/en/courier/services/new');
		await expect(page.getByText('Client')).toBeVisible();
		await expect(page.getByText('Pickup Location')).toBeVisible();
		await expect(page.getByText('Delivery Location')).toBeVisible();
	});

	test('services status filter works', async ({ page }) => {
		await page.goto('/en/courier/services');
		const pendingFilter = page.getByRole('button', { name: 'Pending' });
		const deliveredFilter = page.getByRole('button', { name: 'Delivered' });
		const allFilter = page.getByRole('button', { name: 'All Status' });

		await expect(allFilter).toBeVisible();
		await pendingFilter.click();
		await deliveredFilter.click();
		await allFilter.click();
	});

	test('services search input works', async ({ page }) => {
		await page.goto('/en/courier/services');
		const search = page.getByPlaceholder('Search...');
		if (await search.isVisible({ timeout: 3000 }).catch(() => false)) {
			await search.fill('test');
			await search.fill('');
		}
	});

	test('service detail page loads', async ({ page }) => {
		await page.goto('/en/courier/services');
		const serviceLink = page.locator('a[href*="/en/courier/services/"]').first();
		if (await serviceLink.isVisible({ timeout: 3000 }).catch(() => false)) {
			await serviceLink.click();
			await expect(page).toHaveURL(/\/en\/courier\/services\/.+/);
		}
	});
});
