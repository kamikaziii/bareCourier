import { test, expect, loginAsCourier } from './fixtures';

test.describe('Phase 2: Courier Initial Setup', () => {
	test.beforeEach(async ({ page }) => {
		await loginAsCourier(page);
	});

	test('courier sees dashboard heading and filter buttons', async ({ page }) => {
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Today', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'Tomorrow', exact: true })).toBeVisible();
		await expect(page.getByRole('button', { name: 'All', exact: true })).toBeVisible();
	});

	test('dashboard filter buttons switch', async ({ page }) => {
		await page.getByRole('button', { name: 'All', exact: true }).click();
		await page.getByRole('button', { name: 'Today', exact: true }).click();
	});

	test('navigate to settings and see tabs', async ({ page }) => {
		await page.getByRole('link', { name: 'Settings' }).click();
		await expect(page).toHaveURL(/\/en\/courier\/settings/);
		await expect(page.getByRole('tab', { name: 'Account' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Pricing' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Scheduling' })).toBeVisible();
		await expect(page.getByRole('tab', { name: 'Notifications' })).toBeVisible();
	});

	test('settings account tab has profile form', async ({ page }) => {
		await page.goto('/en/courier/settings?tab=account');
		await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
		await expect(page.getByText('Update your personal information').first()).toBeVisible();
		await expect(page.getByRole('textbox', { name: 'Name' }).first()).toBeVisible();
	});

	test('settings pricing tab loads', async ({ page }) => {
		await page.goto('/en/courier/settings?tab=pricing');
		await expect(page.getByRole('tab', { name: 'Pricing', selected: true })).toBeVisible();
	});

	test('settings scheduling tab loads', async ({ page }) => {
		await page.goto('/en/courier/settings?tab=scheduling');
		await expect(page.getByRole('tab', { name: 'Scheduling', selected: true })).toBeVisible();
	});

	test('settings notifications tab loads', async ({ page }) => {
		await page.goto('/en/courier/settings?tab=notifications');
		await expect(page.getByRole('tab', { name: 'Notifications', selected: true })).toBeVisible();
	});
});
