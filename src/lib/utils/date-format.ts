/**
 * Format a date in Portuguese (pt-PT) long format.
 * Example: "4 de fevereiro de 2026"
 */
export function formatDatePtPT(date: Date | string | null, fallback = ''): string {
	if (!date) return fallback;
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('pt-PT', {
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	});
}

/**
 * Format a date with time in Portuguese (pt-PT) long format.
 * Example: "4 de fevereiro de 2026, 14:30"
 */
export function formatDateTimePtPT(date: Date | string | null, fallback = ''): string {
	if (!date) return fallback;
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('pt-PT', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit'
	});
}
