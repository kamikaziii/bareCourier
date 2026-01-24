<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Card from '$lib/components/ui/card/index.js';

	type Variant = 'stat' | 'service' | 'client';

	let { variant = 'service' }: { variant?: Variant } = $props();
</script>

{#if variant === 'stat'}
	<!-- Stat card skeleton (dashboard stats) -->
	<Card.Root>
		<Card.Content class="flex items-center gap-4 p-6">
			<Skeleton class="size-12 rounded-full" />
			<div class="space-y-2">
				<Skeleton class="h-6 w-12" />
				<Skeleton class="h-4 w-20" />
			</div>
		</Card.Content>
	</Card.Root>
{:else if variant === 'service'}
	<!-- Service card skeleton -->
	<Card.Root>
		<Card.Content class="flex items-start gap-4 p-4">
			<Skeleton class="mt-1 size-4 shrink-0 rounded-full" />
			<div class="min-w-0 flex-1 space-y-2">
				<div class="flex items-center justify-between gap-2">
					<Skeleton class="h-5 w-32" />
					<Skeleton class="h-5 w-16 rounded-full" />
				</div>
				<Skeleton class="h-4 w-full max-w-xs" />
			</div>
		</Card.Content>
	</Card.Root>
{:else if variant === 'client'}
	<!-- Client card skeleton -->
	<Card.Root>
		<Card.Content class="flex items-center justify-between p-4">
			<div class="min-w-0 flex-1 space-y-2">
				<Skeleton class="h-5 w-32" />
				<Skeleton class="h-4 w-48" />
			</div>
			<Skeleton class="size-5" />
		</Card.Content>
	</Card.Root>
{/if}
