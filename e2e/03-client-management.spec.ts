import { test, expect, loginAsCourier } from './fixtures';

test.describe('Phase 3: Client Management', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsCourier(page);
	});

	test('navigate to clients page', async ({ page }) => {
		await page.getByRole('link', { name: 'Clients' }).click();
		await expect(page).toHaveURL(/\/en\/courier\/clients/);
		await expect(page.getByRole('heading', { name: 'Clients', level: 1 })).toBeVisible();
	});

	test('clients list shows active clients section', async ({ page }) => {
		await page.goto('/en/courier/clients');
		await expect(page.getByText(/Active Clients/)).toBeVisible({ timeout: 10000 });
	});

	test('add client form toggles', async ({ page }) => {
		await page.goto('/en/courier/clients');
		await page.getByRole('button', { name: 'Add Client' }).click();
		await expect(page.getByText('Add New Client')).toBeVisible();
		await expect(page.locator('#email')).toBeVisible();
		await expect(page.locator('#password')).toBeVisible();
		await expect(page.locator('#name')).toBeVisible();
	});

	test('client card is clickable to detail', async ({ page }) => {
		await page.goto('/en/courier/clients');
		await page.waitForLoadState('networkidle');
		const clientLink = page.locator('a[href*="/en/courier/clients/"]').first();
		if (await clientLink.isVisible({ timeout: 5000 }).catch(() => false)) {
			await clientLink.click();
			await expect(page).toHaveURL(/\/en\/courier\/clients\/.+/);
		}
	});
});
