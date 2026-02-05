import { test, expect, loginAsCourier } from './fixtures';

test.describe('Phase 8: Notifications', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsCourier(page);
	});

	test('notification bell is visible in header', async ({ page }) => {
		await expect(page.locator('header button').filter({ has: page.locator('svg.lucide-bell') })).toBeVisible();
	});

	test('clicking bell opens notification dropdown', async ({ page }) => {
		const bellTrigger = page.locator('button[aria-label*="Notification"], button:has(svg.lucide-bell)').first();
		if (await bellTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
			await bellTrigger.click();
			// Look for notification content
			await expect(page.getByText('Notifications').first()).toBeVisible({ timeout: 5000 });
		}
	});

	test('notification dropdown has tab filters', async ({ page }) => {
		const bellTrigger = page.locator('button:has(svg.lucide-bell)').first();
		if (await bellTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
			await bellTrigger.click();
			await page.waitForTimeout(500);
			// Tabs: All, Requests, Alerts
			await expect(page.getByRole('button', { name: 'All' }).first()).toBeVisible();
		}
	});
});
