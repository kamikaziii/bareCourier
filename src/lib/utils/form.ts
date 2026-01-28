/**
 * Parse a form value as an integer, clamping to [min, max].
 * Returns defaultVal when the value is null, empty, or not a number.
 * Handles 0 correctly (unlike `|| default` patterns).
 */
export function parseIntWithBounds(
	value: FormDataEntryValue | null,
	min: number,
	max: number,
	defaultVal: number
): number {
	if (value === null || value === '') return defaultVal;
	const parsed = parseInt(value as string, 10);
	if (Number.isNaN(parsed)) return defaultVal;
	return Math.max(min, Math.min(max, parsed));
}
