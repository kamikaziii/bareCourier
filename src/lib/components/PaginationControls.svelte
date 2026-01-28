<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';

	// TODO: Replace hardcoded strings with i18n keys in Task 6
	// import * as m from '$lib/paraglide/messages.js';
	// m.pagination_previous(), m.pagination_next(), m.pagination_page_of({ current, total })

	let {
		currentPage,
		totalPages,
		onPrev,
		onNext
	}: {
		currentPage: number;
		totalPages: number;
		onPrev: () => void;
		onNext: () => void;
	} = $props();
</script>

{#if totalPages > 1}
	<div class="flex items-center justify-center gap-2 py-4">
		<Button variant="outline" size="sm" disabled={currentPage === 1} onclick={onPrev}>
			Previous
		</Button>
		<span class="text-muted-foreground text-sm">
			Page {currentPage} of {totalPages}
		</span>
		<Button variant="outline" size="sm" disabled={currentPage === totalPages} onclick={onNext}>
			Next
		</Button>
	</div>
{/if}
