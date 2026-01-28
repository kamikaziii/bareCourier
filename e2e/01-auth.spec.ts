import { test, expect, loginAsCourier, loginAsClient, COURIER, CLIENT } from './fixtures';

test.describe('Phase 1: Authentication', () => {
	test('courier login redirects to /courier', async ({ page }) => {
		await loginAsCourier(page);
		await expect(page).toHaveURL(/\/en\/courier/);
		await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
	});

	test('client login redirects to /client', async ({ page }) => {
		await loginAsClient(page);
		await expect(page).toHaveURL(/\/en\/client/);
		await expect(page.getByRole('heading', { name: 'My Services' })).toBeVisible();
	});

	test('invalid credentials show error', async ({ page }) => {
		await page.goto('/en/login');
		await page.getByLabel('Email').fill('bad@example.com');
		await page.getByLabel('Password').fill('wrongpassword');
		await page.getByRole('button', { name: 'Sign in' }).click();
		await expect(page.locator('[role="alert"]')).toBeVisible({ timeout: 10000 });
	});

	test('client cannot access /courier', async ({ page }) => {
		await loginAsClient(page);
		await page.goto('/en/courier');
		await expect(page).not.toHaveURL(/\/en\/courier$/);
	});

	test('courier cannot access /client', async ({ page }) => {
		await loginAsCourier(page);
		await page.goto('/en/client');
		await expect(page).not.toHaveURL(/\/en\/client$/);
	});

	test('logout flow', async ({ page }) => {
		await loginAsCourier(page);
		await page.getByRole('button', { name: 'Logout' }).click();
		await expect(page).toHaveURL(/\/en\/login/);
	});
});
