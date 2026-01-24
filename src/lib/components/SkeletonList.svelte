<script lang="ts">
	import SkeletonCard from './SkeletonCard.svelte';

	type Variant = 'stat' | 'service' | 'client';

	let {
		variant = 'service',
		count = 3
	}: {
		variant?: Variant;
		count?: number;
	} = $props();
</script>

<div class="space-y-3">
	{#each Array(count) as _, i (i)}
		<SkeletonCard {variant} />
	{/each}
</div>
