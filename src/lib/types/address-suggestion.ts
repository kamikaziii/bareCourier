export type AddressSuggestion = {
	address: string; // Full address string
	coords: [number, number] | null; // [lng, lat] if available
	isDefault?: boolean; // Shows home icon on chip
};
