/**
 * Shared pagination composable.
 * Accepts a getter for the items array and an optional page size.
 */
export function usePagination<T>(items: () => T[], pageSize = 20) {
	let currentPage = $state(1);

	const totalPages = $derived(Math.max(1, Math.ceil(items().length / pageSize)));
	const paginatedItems = $derived(
		items().slice((currentPage - 1) * pageSize, currentPage * pageSize)
	);
	const totalItems = $derived(items().length);

	function reset() {
		currentPage = 1;
	}

	function prev() {
		if (currentPage > 1) currentPage--;
	}

	function next() {
		if (currentPage < totalPages) currentPage++;
	}

	return {
		get currentPage() {
			return currentPage;
		},
		set currentPage(v: number) {
			currentPage = v;
		},
		get totalPages() {
			return totalPages;
		},
		get paginatedItems() {
			return paginatedItems;
		},
		get totalItems() {
			return totalItems;
		},
		reset,
		prev,
		next
	};
}
