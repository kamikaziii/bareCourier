/**
 * Municipality detection and zone checking utilities
 */

/**
 * Extract municipality name from a Mapbox-style Portuguese address.
 * Format: "Street, Postal Code, Municipality, District, Portugal"
 *
 * @param address - Full address string from Mapbox geocoding
 * @returns Municipality name or null if not detectable
 */
export function extractMunicipalityFromAddress(address: string): string | null {
	if (!address) return null;

	const parts = address.split(',').map((p) => p.trim());

	// Need at least 4 parts: Street, Postal, Municipality, District/Country
	if (parts.length >= 4) {
		// Municipality is typically 3rd from the end (before District and Portugal)
		const potentialMunicipality = parts[parts.length - 3];
		// Skip if it looks like a postal code
		if (potentialMunicipality && !/^\d{4}/.test(potentialMunicipality)) {
			return potentialMunicipality;
		}
	}

	// Fallback: try 2nd from end if we have fewer parts
	if (parts.length >= 3) {
		const potentialMunicipality = parts[parts.length - 2];
		if (
			potentialMunicipality &&
			!/^\d{4}/.test(potentialMunicipality) &&
			potentialMunicipality !== 'Portugal'
		) {
			return potentialMunicipality;
		}
	}

	return null;
}
