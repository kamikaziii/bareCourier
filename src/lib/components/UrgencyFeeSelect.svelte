<script lang="ts">
	import type { UrgencyFee } from '$lib/database.types.js';
	import * as m from '$lib/paraglide/messages.js';

	let {
		fees,
		value = $bindable(''),
		disabled = false,
		id = 'urgency'
	}: {
		fees: UrgencyFee[];
		value: string;
		disabled?: boolean;
		id?: string;
	} = $props();
</script>

<select
	{id}
	name="urgency_fee_id"
	bind:value
	class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
	{disabled}
>
	<option value="">{m.urgency_standard()}</option>
	{#each fees as fee (fee.id)}
		<option value={fee.id}>
			{fee.name}
			{#if fee.multiplier > 1 || fee.flat_fee > 0}
				({fee.multiplier}x{fee.flat_fee > 0 ? ` + €${fee.flat_fee}` : ''})
			{/if}
		</option>
	{/each}
</select>
