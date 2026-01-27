<script lang="ts">
	import type { ServiceStatusHistory } from '$lib/database.types.js';
	import { formatDateTime } from '$lib/utils.js';
	import * as m from '$lib/paraglide/messages.js';

	type StatusHistoryEntry = ServiceStatusHistory & { profiles?: { name: string } | null };

	let { statusHistory }: { statusHistory: StatusHistoryEntry[] } = $props();
</script>

{#if statusHistory.length === 0}
	<p class="text-center text-muted-foreground py-4">{m.no_status_history()}</p>
{:else}
	<div class="space-y-4">
		{#each statusHistory as entry (entry.id)}
			<div class="flex items-start gap-3">
				<div
					class="mt-1 size-3 rounded-full {entry.new_status === 'delivered'
						? 'bg-green-500'
						: 'bg-blue-500'}"
				></div>
				<div class="flex-1">
					<p class="text-sm">
						{#if entry.old_status}
							<span class="capitalize">{entry.old_status}</span>
							&rarr;
						{/if}
						<span class="font-medium capitalize">{entry.new_status}</span>
					</p>
					<p class="text-xs text-muted-foreground">
						{formatDateTime(entry.changed_at)}
						{#if entry.profiles?.name}
							&middot; {entry.profiles.name}
						{/if}
					</p>
				</div>
			</div>
		{/each}
	</div>
{/if}
