import { test as base, type Page } from '@playwright/test';

export const COURIER = {
	email: 'garridoinformaticasupport@gmail.com',
	password: '6Ee281414'
};

export const CLIENT = {
	email: 'test@example.com',
	password: '6Ee281414'
};

async function login(page: Page, email: string, password: string) {
	await page.goto('/en/login');
	await page.waitForLoadState('networkidle');

	// Dismiss PWA update prompt if present
	const closeBtn = page.getByRole('button', { name: 'Close' });
	if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
		await closeBtn.click();
	}

	const emailInput = page.getByLabel('Email');
	await emailInput.waitFor({ state: 'visible' });
	await emailInput.fill(email);

	const passwordInput = page.getByLabel('Password');
	await passwordInput.fill(password);

	await page.getByRole('button', { name: 'Sign in' }).click();
}

export async function loginAsCourier(page: Page) {
	await login(page, COURIER.email, COURIER.password);
	await page.waitForURL(/\/en\/courier/, { timeout: 15000 });
	await page.waitForLoadState('networkidle');
}

export async function loginAsClient(page: Page) {
	await login(page, CLIENT.email, CLIENT.password);
	await page.waitForURL(/\/en\/client/, { timeout: 15000 });
	await page.waitForLoadState('networkidle');
}

export const test = base;
export { expect } from '@playwright/test';
