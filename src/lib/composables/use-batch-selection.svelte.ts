/**
 * Shared batch selection composable for courier pages.
 * Encapsulates selection mode toggle, individual/bulk selection, and derived counts.
 */
export function useBatchSelection() {
	const MAX_BATCH_SIZE = 50;

	let selectionMode = $state(false);
	let selectedIds = $state<Set<string>>(new Set());
	let exceedsLimit = $state(false);

	const selectedCount = $derived(selectedIds.size);
	const hasSelection = $derived(selectedCount > 0);

	function toggleSelectionMode() {
		selectionMode = !selectionMode;
		if (!selectionMode) {
			selectedIds = new Set();
			exceedsLimit = false;
		}
	}

	function toggle(id: string) {
		const s = new Set(selectedIds);
		if (s.has(id)) {
			s.delete(id);
		} else {
			s.add(id);
		}
		selectedIds = s;
		exceedsLimit = s.size > MAX_BATCH_SIZE;
	}

	function selectAll(ids: string[]) {
		if (ids.length > MAX_BATCH_SIZE) {
			selectedIds = new Set(ids.slice(0, MAX_BATCH_SIZE));
			exceedsLimit = true;
		} else {
			selectedIds = new Set(ids);
			exceedsLimit = false;
		}
	}

	function deselectAll() {
		selectedIds = new Set();
		exceedsLimit = false;
	}

	function reset() {
		selectionMode = false;
		selectedIds = new Set();
		exceedsLimit = false;
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
		get exceedsLimit() { return exceedsLimit; },
		get maxBatchSize() { return MAX_BATCH_SIZE; },
		toggleSelectionMode,
		toggle,
		selectAll,
		deselectAll,
		reset,
		has
	};
}
