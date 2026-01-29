<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData, ActionData } from './$types';
	import { ArrowLeft, Package } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	let name = $state('');
	let email = $state('');
	let phone = $state('');
	let defaultPickupLocation = $state('');
	let defaultServiceTypeId = $state('');
</script>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href={localizeHref('/courier/clients')}>
			<ArrowLeft class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">{m.new_client()}</h1>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.client_info()}</Card.Title>
			<Card.Description>{m.new_client_desc()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<form
				method="POST"
				use:enhance={() => {
					loading = true;
					return async ({ update }) => {
						loading = false;
						await update();
					};
				}}
				class="space-y-4"
			>
				{#if form?.error}
					<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
						{form.error}
					</div>
				{/if}

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="name">{m.form_name()} *</Label>
						<Input
							id="name"
							name="name"
							type="text"
							bind:value={name}
							required
							disabled={loading}
						/>
					</div>
					<div class="space-y-2">
						<Label for="email">{m.auth_email()} *</Label>
						<Input
							id="email"
							name="email"
							type="email"
							bind:value={email}
							required
							disabled={loading}
						/>
					</div>
				</div>

				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="phone">{m.form_phone()}</Label>
						<Input
							id="phone"
							name="phone"
							type="tel"
							bind:value={phone}
							disabled={loading}
						/>
					</div>
					<div class="space-y-2">
						<Label for="location">{m.clients_default_location()}</Label>
						<Input
							id="location"
							name="default_pickup_location"
							type="text"
							bind:value={defaultPickupLocation}
							disabled={loading}
						/>
					</div>
				</div>

				{#if data.pricingMode === 'type' && data.serviceTypes.length > 0}
					<div class="space-y-2">
						<Label for="default_service_type_id">
							<span class="flex items-center gap-2">
								<Package class="size-4 text-muted-foreground" />
								{m.default_service_type()}
							</span>
						</Label>
						<select
							id="default_service_type_id"
							name="default_service_type_id"
							bind:value={defaultServiceTypeId}
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
							disabled={loading}
						>
							<option value="">{m.none()}</option>
							{#each data.serviceTypes as type (type.id)}
								<option value={type.id}>{type.name} - {Number(type.price).toFixed(2)}</option>
							{/each}
						</select>
						<p class="text-xs text-muted-foreground">{m.default_service_type_desc()}</p>
					</div>
				{/if}

				<div class="flex gap-3 pt-4">
					<Button type="submit" disabled={loading || !name.trim() || !email.trim()}>
						{loading ? m.saving() : m.action_save()}
					</Button>
					<Button
						type="button"
						variant="outline"
						href={localizeHref('/courier/clients')}
						disabled={loading}
					>
						{m.action_cancel()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
