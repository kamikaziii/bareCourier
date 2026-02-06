import type { AppLocale } from '$lib/services/notifications.js';

/**
 * Map AppLocale to the Intl locale string used by toLocaleDateString.
 * 'pt-PT' maps directly; 'en' maps to 'en-GB' for European-style English dates.
 */
function toIntlLocale(locale: AppLocale): string {
	return locale === 'en' ? 'en-GB' : locale;
}

/**
 * Format a date in long format, respecting the user's locale.
 * Examples:
 *   pt-PT: "4 de fevereiro de 2026"
 *   en:    "4 February 2026"
 */
export function formatDate(
	date: Date | string | null,
	locale: AppLocale = 'pt-PT',
	fallback = ''
): string {
	if (!date) return fallback;
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return fallback;
	return d.toLocaleDateString(toIntlLocale(locale), {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Format a date with time in long format, respecting the user's locale.
 * Examples:
 *   pt-PT: "4 de fevereiro de 2026, 14:30"
 *   en:    "4 February 2026, 14:30"
 */
export function formatDateTime(
	date: Date | string | null,
	locale: AppLocale = 'pt-PT',
	fallback = ''
): string {
	if (!date) return fallback;
	const d = typeof date === 'string' ? new Date(date) : date;
	if (isNaN(d.getTime())) return fallback;
	return d.toLocaleDateString(toIntlLocale(locale), {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}

/**
 * Locale-aware fallback strings for common date placeholders used in emails.
 */
const DATE_FALLBACKS: Record<string, Record<AppLocale, string>> = {
	not_scheduled: { 'pt-PT': 'Não agendada', en: 'Not scheduled' },
	not_specified: { 'pt-PT': 'Não especificada', en: 'Not specified' },
	not_provided: { 'pt-PT': 'Não especificado', en: 'Not provided' }
};

/**
 * Get a locale-aware fallback string for date placeholders in emails.
 */
export function dateFallback(
	key: 'not_scheduled' | 'not_specified' | 'not_provided',
	locale: AppLocale = 'pt-PT'
): string {
	return DATE_FALLBACKS[key][locale];
}

// ---------------------------------------------------------------------------
// Deprecated aliases - kept for backward compatibility
// ---------------------------------------------------------------------------

/** @deprecated Use `formatDate(date, locale, fallback)` instead. */
export const formatDatePtPT = (date: Date | string | null, fallback = ''): string =>
	formatDate(date, 'pt-PT', fallback);

/** @deprecated Use `formatDateTime(date, locale, fallback)` instead. */
export const formatDateTimePtPT = (date: Date | string | null, fallback = ''): string =>
	formatDateTime(date, 'pt-PT', fallback);
