<script lang="ts">
	import { goto } from '$app/navigation';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import * as m from '$lib/paraglide/messages.js';
	import * as Sheet from '$lib/components/ui/sheet/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { type NavItem, isItemActive } from '$lib/types/navigation.js';

	interface MoreDrawerProps {
		items: NavItem[];
		currentPath: string;
		open: boolean;
	}

	let { items, currentPath, open = $bindable() }: MoreDrawerProps = $props();

	function handleItemClick(href: string) {
		open = false;
		goto(localizeHref(href));
	}

	function formatBadge(count: number | undefined): string | null {
		if (!count || count <= 0) return null;
		if (count > 99) return '99+';
		return count.toString();
	}
</script>

<Sheet.Root bind:open>
	<Sheet.Content side="bottom" class="pb-safe">
		<Sheet.Header class="text-left">
			<Sheet.Title>{m.nav_more()}</Sheet.Title>
		</Sheet.Header>
		<nav class="mt-4 grid gap-1">
			{#each items as item (item.href)}
				{@const Icon = item.icon}
				{@const active = isItemActive(item.href, currentPath)}
				{@const displayBadge = formatBadge(item.badge)}
				<button
					onclick={() => handleItemClick(item.href)}
					class="flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors
						{active
						? 'bg-accent text-accent-foreground'
						: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'}"
					aria-label={displayBadge ? `${item.label}, ${item.badge} pending` : item.label}
				>
					<Icon class="size-5" />
					<span class="flex-1">{item.label}</span>
					{#if displayBadge}
						<Badge
							variant="destructive"
							class="h-5 min-w-5 rounded-full px-1.5 text-xs font-mono tabular-nums flex items-center justify-center"
						>
							{displayBadge}
						</Badge>
					{/if}
				</button>
			{/each}
		</nav>
	</Sheet.Content>
</Sheet.Root>

<style>
	/* Safe area padding for bottom sheet */
	:global(.pb-safe) {
		padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
	}
</style>
