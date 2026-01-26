<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import AddressInput from '$lib/components/AddressInput.svelte';
	import { User, Warehouse } from '@lucide/svelte';
	import type { Profile } from '$lib/database.types.js';
	import type { Session } from '@supabase/supabase-js';

	interface Props {
		profile: Profile;
		session: Session | null;
	}

	let { profile, session }: Props = $props();

	// Warehouse address state
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let warehouseAddress = $state(profile.default_pickup_location || '');
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let warehouseCoords = $state<[number, number] | null>(
		profile.warehouse_lat && profile.warehouse_lng
			? [profile.warehouse_lng, profile.warehouse_lat]
			: null
	);
</script>

<!-- Profile Settings -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<User class="size-5" />
			{m.settings_profile()}
		</Card.Title>
		<Card.Description>{m.settings_profile_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updateProfile" use:enhance class="space-y-4">
			<div class="grid gap-4 md:grid-cols-2">
				<div class="space-y-2">
					<Label for="name">{m.form_name()}</Label>
					<Input id="name" name="name" value={profile.name} required />
				</div>
				<div class="space-y-2">
					<Label for="phone">{m.form_phone()}</Label>
					<Input id="phone" name="phone" type="tel" value={profile.phone || ''} />
				</div>
			</div>
			<div class="space-y-2">
				<Label>{m.auth_email()}</Label>
				<Input disabled value={session?.user?.email || ''} />
				<p class="text-xs text-muted-foreground">{m.settings_email_readonly()}</p>
			</div>
			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

<!-- Default Location -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Warehouse class="size-5" />
			{m.settings_default_location()}
		</Card.Title>
		<Card.Description>{m.settings_courier_default_location_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updateWarehouseLocation" use:enhance class="space-y-4">
			<div class="space-y-2">
				<Label for="default_pickup_location">{m.settings_warehouse_address()}</Label>
				<AddressInput
					id="default_pickup_location"
					bind:value={warehouseAddress}
					onSelect={(address, coords) => {
						warehouseAddress = address;
						warehouseCoords = coords;
					}}
					placeholder={m.form_warehouse_placeholder()}
				/>
				{#if warehouseCoords}
					<p class="text-xs text-green-600">{m.address_verified()}</p>
				{:else if warehouseAddress}
					<p class="text-xs text-orange-600">{m.settings_warehouse_select_hint()}</p>
				{:else}
					<p class="text-xs text-muted-foreground">{m.settings_warehouse_hint()}</p>
				{/if}
				<input type="hidden" name="default_pickup_location" value={warehouseAddress} />
				<input type="hidden" name="warehouse_lat" value={warehouseCoords?.[1] ?? ''} />
				<input type="hidden" name="warehouse_lng" value={warehouseCoords?.[0] ?? ''} />
			</div>
			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>
