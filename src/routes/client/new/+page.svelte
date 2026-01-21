<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const defaultPickup = data.profile?.default_pickup_location || '';
	let pickupLocation = $state(defaultPickup);
	let deliveryLocation = $state('');
	let notes = $state('');
	let loading = $state(false);
	let error = $state('');

	async function handleSubmit(e: Event) {
		e.preventDefault();
		loading = true;
		error = '';

		const { error: insertError } = await data.supabase.from('services').insert({
			client_id: data.session?.user.id,
			pickup_location: pickupLocation,
			delivery_location: deliveryLocation,
			notes: notes || null
		});

		if (insertError) {
			error = insertError.message;
			loading = false;
			return;
		}

		goto('/client');
	}
</script>

<div class="max-w-md mx-auto space-y-6">
	<div>
		<h1 class="text-2xl font-bold">New Service Request</h1>
		<p class="text-muted-foreground">Request a new pickup/delivery</p>
	</div>

	<Card.Root>
		<Card.Content class="pt-6">
			<form onsubmit={handleSubmit} class="space-y-4">
				{#if error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{error}
					</div>
				{/if}

				<div class="space-y-2">
					<Label for="pickup">Pickup Location</Label>
					<Input
						id="pickup"
						type="text"
						placeholder="Your lab address"
						bind:value={pickupLocation}
						required
						disabled={loading}
					/>
				</div>

				<div class="space-y-2">
					<Label for="delivery">Delivery Location</Label>
					<Input
						id="delivery"
						type="text"
						placeholder="Destination address"
						bind:value={deliveryLocation}
						required
						disabled={loading}
					/>
				</div>

				<div class="space-y-2">
					<Label for="notes">Notes (optional)</Label>
					<Input
						id="notes"
						type="text"
						placeholder="Any special instructions"
						bind:value={notes}
						disabled={loading}
					/>
				</div>

				<div class="flex gap-2 pt-2">
					<Button type="button" variant="outline" class="flex-1" onclick={() => goto('/client')}>
						Cancel
					</Button>
					<Button type="submit" class="flex-1" disabled={loading}>
						{loading ? 'Creating...' : 'Create Request'}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
