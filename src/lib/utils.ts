import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getLocale } from '$lib/paraglide/runtime.js';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Date formatting utilities using the current locale

/**
 * Format a date with basic locale formatting
 */
export function formatDate(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString(getLocale());
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleString(getLocale());
}

/**
 * Format a date with short month (e.g., "15 Jan")
 */
export function formatDateShort(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString(getLocale(), {
		day: 'numeric',
		month: 'short'
	});
}

/**
 * Format a date with weekday, day, and short month (e.g., "Mon, 15 Jan")
 */
export function formatDateWithWeekday(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString(getLocale(), {
		weekday: 'short',
		day: 'numeric',
		month: 'short'
	});
}

/**
 * Format a date with full weekday, day, and long month (e.g., "Monday, 15 January")
 */
export function formatDateFull(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString(getLocale(), {
		weekday: 'long',
		day: 'numeric',
		month: 'long'
	});
}

/**
 * Format a date with month and year (e.g., "January 2024")
 */
export function formatMonthYear(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString(getLocale(), {
		month: 'long',
		year: 'numeric'
	});
}

// Type helpers for shadcn-svelte components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Creates a debounced version of a function that delays execution
 * until after the specified delay has elapsed since the last call.
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout>;
	return (...args: Parameters<T>) => {
		clearTimeout(timeoutId);
		timeoutId = setTimeout(() => fn(...args), delay);
	};
}
