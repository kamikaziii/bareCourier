/**
 * Shared batch selection composable for courier pages.
 * Encapsulates selection mode toggle, individual/bulk selection, and derived counts.
 */
export function useBatchSelection() {
	let selectionMode = $state(false);
	let selectedIds = $state<Set<string>>(new Set());

	const selectedCount = $derived(selectedIds.size);
	const hasSelection = $derived(selectedCount > 0);

	function toggleSelectionMode() {
		selectionMode = !selectionMode;
		if (!selectionMode) selectedIds = new Set();
	}

	function toggle(id: string) {
		const s = new Set(selectedIds);
		if (s.has(id)) s.delete(id);
		else s.add(id);
		selectedIds = s;
	}

	function selectAll(ids: string[]) {
		selectedIds = new Set(ids);
	}

	function deselectAll() {
		selectedIds = new Set();
	}

	function reset() {
		selectionMode = false;
		selectedIds = new Set();
	}

	function has(id: string): boolean {
		return selectedIds.size > 0 && selectedIds.has(id);
	}

	return {
		get selectionMode() { return selectionMode; },
		set selectionMode(v: boolean) { selectionMode = v; },
		get selectedIds() { return selectedIds; },
		get selectedCount() { return selectedCount; },
		get hasSelection() { return hasSelection; },
		toggleSelectionMode,
		toggle,
		selectAll,
		deselectAll,
		reset,
		has
	};
}
