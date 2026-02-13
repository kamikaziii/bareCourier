export type AddressSuggestion = {
	label: string; // Truncated display text (~30 chars)
	address: string; // Full address string
	coords: [number, number] | null; // [lng, lat] if available
	isDefault?: boolean; // Shows home icon on chip
};
