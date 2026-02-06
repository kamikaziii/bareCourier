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

	const emailInput = page.getByLabel('Email');
	await emailInput.waitFor({ state: 'visible' });
	await emailInput.fill(email);

	const passwordInput = page.getByLabel('Password');
	await passwordInput.fill(password);

	const signInButton = page.getByRole('button', { name: 'Sign in' });

	// Wait for navigation after clicking sign in
	// The app does: /login -> goto('/') -> server redirect to /courier or /client
	await Promise.all([
		page.waitForURL(/\/en\/(courier|client)/, { timeout: 15000 }),
		signInButton.click()
	]);

	// Wait for page to be fully loaded after navigation
	await page.waitForLoadState('domcontentloaded');
}

export async function loginAsCourier(page: Page) {
	await login(page, COURIER.email, COURIER.password);
}

export async function loginAsClient(page: Page) {
	await login(page, CLIENT.email, CLIENT.password);
}

export const test = base;
export { expect } from '@playwright/test';
