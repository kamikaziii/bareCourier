<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import * as m from '$lib/paraglide/messages.js';

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
			{m.pagination_previous()}
		</Button>
		<span class="text-muted-foreground text-sm">
			{m.pagination_page_of({ current: currentPage, total: totalPages })}
		</span>
		<Button variant="outline" size="sm" disabled={currentPage === totalPages} onclick={onNext}>
			{m.pagination_next()}
		</Button>
	</div>
{/if}
