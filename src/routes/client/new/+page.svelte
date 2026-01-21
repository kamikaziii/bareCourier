<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
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

		goto(localizeHref('/client'));
	}
</script>

<div class="max-w-md mx-auto space-y-6">
	<div>
		<h1 class="text-2xl font-bold">{m.client_new_title()}</h1>
		<p class="text-muted-foreground">{m.client_new_subtitle()}</p>
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
					<Label for="pickup">{m.form_pickup_location()}</Label>
					<Input
						id="pickup"
						type="text"
						placeholder={m.form_pickup_placeholder()}
						bind:value={pickupLocation}
						required
						disabled={loading}
					/>
				</div>

				<div class="space-y-2">
					<Label for="delivery">{m.form_delivery_location()}</Label>
					<Input
						id="delivery"
						type="text"
						placeholder={m.form_delivery_placeholder()}
						bind:value={deliveryLocation}
						required
						disabled={loading}
					/>
				</div>

				<div class="space-y-2">
					<Label for="notes">{m.form_notes_optional()}</Label>
					<Input
						id="notes"
						type="text"
						placeholder={m.form_notes_placeholder()}
						bind:value={notes}
						disabled={loading}
					/>
				</div>

				<div class="flex gap-2 pt-2">
					<Button type="button" variant="outline" class="flex-1" onclick={() => goto(localizeHref('/client'))}>
						{m.services_cancel()}
					</Button>
					<Button type="submit" class="flex-1" disabled={loading}>
						{loading ? m.services_creating() : m.client_create_request()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
