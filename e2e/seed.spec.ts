import { test, expect } from '@playwright/test';
import { loginAsCourier, loginAsClient } from './fixtures';

/**
 * Seed file for Playwright Test Agents.
 * Contains setup fixtures that get copied into generated tests.
 *
 * The agents will use these seeds based on the test plan requirements:
 * - "courier seed" → Tests requiring courier authentication
 * - "client seed" → Tests requiring client authentication
 * - "unauthenticated seed" → Tests for public pages (login, etc.)
 */

test.describe('bareCourier seeds', () => {
	test('courier seed', async ({ page }) => {
		// Setup for tests requiring courier authentication
		await loginAsCourier(page);
		await expect(page).toHaveURL(/\/en\/courier/);
	});

	test('client seed', async ({ page }) => {
		// Setup for tests requiring client authentication
		await loginAsClient(page);
		await expect(page).toHaveURL(/\/en\/client/);
	});

	test('unauthenticated seed', async ({ page }) => {
		// Setup for tests on public pages
		await page.goto('/en/login');
		await page.waitForLoadState('domcontentloaded');
	});
});
