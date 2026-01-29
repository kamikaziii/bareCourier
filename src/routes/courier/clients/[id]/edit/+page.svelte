<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { localizeHref } from '$lib/paraglide/runtime.js';
	import type { PageData, ActionData } from './$types';
	import type { PricingModel } from '$lib/database.types.js';
	import { ArrowLeft, Euro, ChevronDown, Package } from '@lucide/svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let loading = $state(false);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form editing
	let name = $state(data.client.name);
	// svelte-ignore state_referenced_locally
	let phone = $state(data.client.phone || '');
	// svelte-ignore state_referenced_locally
	let defaultPickupLocation = $state(data.client.default_pickup_location || '');
	// svelte-ignore state_referenced_locally
	let defaultServiceTypeId = $state(data.client.default_service_type_id || '');

	// Pricing state - svelte-ignore state_referenced_locally for all: intentional initial value capture
	// svelte-ignore state_referenced_locally
	let showPricingSection = $state(!!data.pricing);
	// svelte-ignore state_referenced_locally
	let pricingModel = $state<PricingModel>((data.pricing?.pricing_model as PricingModel) || 'per_km');
	// svelte-ignore state_referenced_locally
	let baseFee = $state(data.pricing?.base_fee?.toString() || '0');
	// svelte-ignore state_referenced_locally
	let perKmRate = $state(data.pricing?.per_km_rate?.toString() || '0');
	// svelte-ignore state_referenced_locally
	let zones = $state(
		data.zones.length > 0
			? data.zones.map((z) => ({ min_km: z.min_km, max_km: z.max_km, price: z.price }))
			: [
					{ min_km: 0, max_km: 5, price: 3 },
					{ min_km: 5, max_km: 10, price: 5 },
					{ min_km: 10, max_km: 20, price: 8 },
					{ min_km: 20, max_km: null, price: 12 }
				]
	);

	function addZone() {
		const lastZone = zones[zones.length - 1];
		const newMinKm = lastZone?.max_km || 0;
		zones = [...zones, { min_km: newMinKm, max_km: newMinKm + 10, price: 0 }];
	}

	function removeZone(index: number) {
		zones = zones.filter((_, i) => i !== index);
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-3">
		<Button variant="ghost" size="sm" href={localizeHref(`/courier/clients/${data.client.id}`)}>
			<ArrowLeft class="size-4" />
		</Button>
		<h1 class="text-2xl font-bold">{m.edit_client()}</h1>
	</div>

	<Card.Root>
		<Card.Header>
			<Card.Title>{m.client_info()}</Card.Title>
			<Card.Description>{m.edit_client_desc()}</Card.Description>
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
						<Label for="phone">{m.form_phone()}</Label>
						<Input id="phone" name="phone" type="tel" bind:value={phone} disabled={loading} />
					</div>
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
								<option value={type.id}>{type.name} - €{Number(type.price).toFixed(2)}</option>
							{/each}
						</select>
						<p class="text-xs text-muted-foreground">{m.default_service_type_desc()}</p>
					</div>
				{/if}

				<Separator />

				<!-- Pricing Configuration -->
				<div class="space-y-4">
					<button
						type="button"
						class="flex w-full items-center justify-between text-left"
						onclick={() => (showPricingSection = !showPricingSection)}
						disabled={loading}
					>
						<div class="flex items-center gap-2">
							<Euro class="size-5 text-muted-foreground" />
							<span class="font-medium">{m.billing_pricing_config()}</span>
							{#if data.pricing}
								<Badge variant="outline">{m.billing_configured()}</Badge>
							{/if}
						</div>
						<ChevronDown
							class="size-5 text-muted-foreground transition-transform {showPricingSection
								? 'rotate-180'
								: ''}"
						/>
					</button>

					{#if showPricingSection}
						<div class="rounded-md border p-4 space-y-4">
							<p class="text-sm text-muted-foreground">{m.billing_pricing_config_desc()}</p>

							<div class="space-y-2">
								<Label for="pricing_model">{m.billing_pricing_model()}</Label>
								<select
									id="pricing_model"
									name="pricing_model"
									bind:value={pricingModel}
									class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
									disabled={loading}
								>
									<option value="per_km">{m.billing_model_per_km()}</option>
									<option value="flat_plus_km">{m.billing_model_flat_plus_km()}</option>
									<option value="zone">{m.billing_model_zone()}</option>
								</select>
							</div>

							{#if pricingModel !== 'zone'}
								<div class="grid gap-4 md:grid-cols-2">
									<div class="space-y-2">
										<Label for="base_fee">{m.billing_base_fee()}</Label>
										<div class="relative">
											<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
											<Input
												id="base_fee"
												name="base_fee"
												type="number"
												step="0.01"
												min="0"
												bind:value={baseFee}
												class="pl-9"
												disabled={loading}
											/>
										</div>
									</div>
									<div class="space-y-2">
										<Label for="per_km_rate">{m.billing_per_km_rate()}</Label>
										<div class="relative">
											<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
											<Input
												id="per_km_rate"
												name="per_km_rate"
												type="number"
												step="0.01"
												min="0"
												bind:value={perKmRate}
												class="pl-9"
												disabled={loading}
											/>
										</div>
									</div>
								</div>
							{:else}
								<!-- Zone Configuration -->
								<div class="space-y-3">
									<Label>{m.billing_zones()}</Label>
									<p class="text-xs text-muted-foreground">{m.billing_zones_desc()}</p>

									<div class="space-y-2">
										{#each zones as zone, index (index)}
											<div class="flex items-center gap-2">
												<Input
													type="number"
													step="0.1"
													min="0"
													bind:value={zone.min_km}
													placeholder="Min km"
													class="w-20"
													disabled={loading}
												/>
												<span class="text-muted-foreground">-</span>
												<Input
													type="number"
													step="0.1"
													min="0"
													value={zone.max_km ?? ''}
													onchange={(e) => {
														const value = e.currentTarget.value;
														zone.max_km = value ? parseFloat(value) : null;
													}}
													placeholder={m.billing_zone_max_placeholder()}
													class="w-28"
													disabled={loading}
												/>
												<span class="text-muted-foreground">km =</span>
												<div class="relative flex-1">
													<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
													<Input
														type="number"
														step="0.01"
														min="0"
														bind:value={zone.price}
														class="pl-9"
														disabled={loading}
													/>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="sm"
													onclick={() => removeZone(index)}
													disabled={zones.length <= 1 || loading}
												>
													×
												</Button>
											</div>
										{/each}
									</div>

									<Button type="button" variant="outline" size="sm" onclick={addZone} disabled={loading}>
										{m.billing_add_zone()}
									</Button>
								</div>

								<!-- Hidden input for zones JSON -->
								<input type="hidden" name="zones" value={JSON.stringify(zones)} />
								<input type="hidden" name="base_fee" value="0" />
								<input type="hidden" name="per_km_rate" value="0" />
							{/if}
						</div>
					{/if}
				</div>

				<div class="flex gap-3 pt-4">
					<Button type="submit" disabled={loading}>
						{loading ? m.saving() : m.action_save()}
					</Button>
					<Button
						type="button"
						variant="outline"
						href={localizeHref(`/courier/clients/${data.client.id}`)}
						disabled={loading}
					>
						{m.action_cancel()}
					</Button>
				</div>
			</form>
		</Card.Content>
	</Card.Root>
</div>
