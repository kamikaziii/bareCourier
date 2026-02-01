import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getLocale } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

// Intl.NumberFormat cache for performance optimization
// Creating Intl.NumberFormat instances is expensive (0.5-2ms each)
// With tables showing 50+ rows, caching saves 200-300ms overhead
const formatterCache = new Map<
	string,
	{
		currency: Intl.NumberFormat;
		distance: Map<number, Intl.NumberFormat>;
	}
>();

function getFormatters(locale: string) {
	let cached = formatterCache.get(locale);
	if (!cached) {
		cached = {
			currency: new Intl.NumberFormat(locale, {
				style: 'currency',
				currency: 'EUR'
			}),
			distance: new Map()
		};
		formatterCache.set(locale, cached);
	}
	return cached;
}

function getDistanceFormatter(locale: string, decimals: number): Intl.NumberFormat {
	const formatters = getFormatters(locale);
	let formatter = formatters.distance.get(decimals);
	if (!formatter) {
		formatter = new Intl.NumberFormat(locale, {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals
		});
		formatters.distance.set(decimals, formatter);
	}
	return formatter;
}

// Date formatting utilities using the current locale

/**
 * Format a date with basic locale formatting
 */
export function formatDate(date: Date | string | null): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString(getLocale());
}

/**
 * Format a date with time
 */
export function formatDateTime(date: Date | string | null): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleString(getLocale());
}

/**
 * Format a date with weekday, day, and short month (e.g., "Mon, 15 Jan")
 */
export function formatDateWithWeekday(date: Date | string | null): string {
	if (!date) return '';
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
export function formatDateFull(date: Date | string | null): string {
	if (!date) return '';
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
export function formatMonthYear(date: Date | string | null): string {
	if (!date) return '';
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString(getLocale(), {
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Format a time slot value to a localized display string
 */
export function formatTimeSlot(slot: string | null): string {
	if (!slot) return '';
	switch (slot) {
		case 'morning':
			return m.time_slot_morning();
		case 'afternoon':
			return m.time_slot_afternoon();
		case 'evening':
			return m.time_slot_evening();
		case 'specific':
			return m.time_slot_specific();
		default:
			return slot;
	}
}

// Type helpers for shadcn-svelte components
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, 'child'> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any } ? Omit<T, 'children'> : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & { ref?: U | null };

/**
 * Filtered session type that excludes sensitive tokens.
 * Used instead of full Session to prevent token exposure to client.
 */
export type SafeSession = {
	expires_at?: number;
	user: {
		id: string;
		email?: string;
	};
} | null;

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

/**
 * Format a date string as relative time (e.g., "5 minutes ago", "2 hours ago").
 * Falls back to locale-formatted date for dates older than 7 days.
 */
export function formatRelativeTime(dateStr: string): string {
	const date = new Date(dateStr);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMs / 3600000);
	const diffDays = Math.floor(diffMs / 86400000);

	if (diffMins < 1) return m.time_just_now();
	if (diffMins < 60)
		return m.time_minutes_ago({ count: diffMins });
	if (diffHours < 24)
		return m.time_hours_ago({ count: diffHours });
	if (diffDays < 7)
		return m.time_days_ago({ count: diffDays });
	return date.toLocaleDateString(getLocale());
}

/**
 * Format a badge count for display.
 * Returns null if count is falsy or <= 0.
 * Returns "{max}+" if count exceeds max threshold.
 * @param count - The badge count to format
 * @param max - Maximum value before showing "max+" (default: 99)
 */
export function formatBadge(count: number | undefined, max: number = 99): string | null {
	if (!count || count <= 0) return null;
	if (count > max) return `${max}+`;
	return count.toString();
}

/**
 * Converts minutes to human-readable format (e.g., "1h 30m")
 */
export function formatMinutesToHuman(minutes: number): string {
	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;
	if (hours === 0) return `${mins}m`;
	if (mins === 0) return `${hours}h`;
	return `${hours}h ${mins}m`;
}

/**
 * Format a currency value using the current locale.
 * Uses EUR currency with Portuguese locale formatting (e.g., "1.234,56 €").
 * Uses cached Intl.NumberFormat instance for performance.
 * @param value - The numeric value to format
 * @returns Formatted currency string
 */
export function formatCurrency(value: number): string {
	return getFormatters(getLocale()).currency.format(value);
}

/**
 * Format a distance value in kilometers using the current locale.
 * Uses cached Intl.NumberFormat instance for performance.
 * @param km - The distance in kilometers, or null
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted number string, or empty string if null
 */
export function formatDistance(km: number | null, decimals: number = 1): string {
	if (km === null) return '';
	return getDistanceFormatter(getLocale(), decimals).format(km);
}
