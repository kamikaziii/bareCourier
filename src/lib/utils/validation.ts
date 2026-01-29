/**
 * UUID v4 validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates a UUID string format
 */
export function isValidUUID(value: string | null | undefined): boolean {
	return !!value && UUID_REGEX.test(value);
}
