<script lang="ts">
	import { enhance } from '$app/forms';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { Zap, Plus, Trash2, Power, MapPin, Warehouse, Calculator, Pencil, Receipt, Package } from '@lucide/svelte';
	import type { Profile, UrgencyFee } from '$lib/database.types.js';

	/** Portuguese standard VAT rate (%) */
	const DEFAULT_VAT_RATE = 23;

	interface Props {
		profile: Profile;
		urgencyFees: UrgencyFee[];
	}

	let { profile, urgencyFees }: Props = $props();

	// State for urgency fees
	let showNewUrgencyForm = $state(false);
	let newUrgency = $state({ name: '', description: '', multiplier: '1.0', flat_fee: '0' });

	// Editable urgency fees state
	let editingFeeId = $state<string | null>(null);

	// Delete confirmation state
	let deletingFeeId = $state<string | null>(null);
	let deleteDialogOpen = $state(false);

	// Derived values from props - using `let` allows temporary override for optimistic UI
	// When profile updates (after form save), derived values auto-recalculate from new props
	let pricingMode = $derived((profile.pricing_mode as 'warehouse' | 'zone' | 'type') ?? 'warehouse');
	let showPriceToCourier = $derived(profile.show_price_to_courier ?? true);
	let showPriceToClient = $derived(profile.show_price_to_client ?? true);
	let defaultUrgencyFeeId = $derived(profile.default_urgency_fee_id || '');
	let minimumCharge = $derived(profile.minimum_charge ?? 0);
	let roundDistance = $derived(profile.round_distance ?? false);
	let vatEnabled = $derived(profile.vat_enabled ?? false);
	let vatRate = $derived(profile.vat_rate ?? DEFAULT_VAT_RATE);
	let pricesIncludeVat = $derived(profile.prices_include_vat ?? false);

	function openDeleteDialog(feeId: string) {
		deletingFeeId = feeId;
		deleteDialogOpen = true;
	}
</script>

<!-- Pricing Mode Settings -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<MapPin class="size-5" />
			{m.settings_pricing_mode()}
		</Card.Title>
		<Card.Description>{m.settings_pricing_mode_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updatePricingMode" use:enhance class="space-y-4">
			<div class="space-y-3">
				<!-- Warehouse Option -->
				<label
					class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode === 'warehouse' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}"
				>
					<input
						type="radio"
						name="pricing_mode"
						value="warehouse"
						checked={pricingMode === 'warehouse'}
						onchange={() => pricingMode = 'warehouse'}
						class="mt-1"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Warehouse class="size-4" />
							<span class="font-medium">{m.pricing_mode_warehouse()}</span>
						</div>
						<p class="mt-1 text-sm text-muted-foreground">
							{m.pricing_mode_warehouse_desc()}
						</p>
					</div>
				</label>

				<!-- Zone Option -->
				<label
					class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode === 'zone' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}"
				>
					<input
						type="radio"
						name="pricing_mode"
						value="zone"
						checked={pricingMode === 'zone'}
						onchange={() => pricingMode = 'zone'}
						class="mt-1"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<MapPin class="size-4" />
							<span class="font-medium">{m.pricing_mode_zone()}</span>
						</div>
						<p class="mt-1 text-sm text-muted-foreground">
							{m.pricing_mode_zone_desc()}
						</p>
					</div>
				</label>

				<!-- Type-based Option -->
				<label
					class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode === 'type' ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}"
				>
					<input
						type="radio"
						name="pricing_mode"
						value="type"
						checked={pricingMode === 'type'}
						onchange={() => pricingMode = 'type'}
						class="mt-1"
					/>
					<div class="flex-1">
						<div class="flex items-center gap-2">
							<Package class="size-4" />
							<span class="font-medium">{m.pricing_mode_type()}</span>
						</div>
						<p class="mt-1 text-sm text-muted-foreground">
							{m.pricing_mode_type_desc()}
						</p>
					</div>
				</label>
			</div>
			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

{#if pricingMode === 'type'}
	<!-- Special Pricing Settings -->
	{#key `${profile.time_specific_price}-${profile.out_of_zone_base}-${profile.out_of_zone_per_km}`}
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Calculator class="size-5" />
					{m.special_pricing()}
				</Card.Title>
				<Card.Description>{m.special_pricing_desc()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<form method="POST" action="?/updateSpecialPricing" use:enhance class="space-y-4">
					<div class="grid gap-4 md:grid-cols-3">
						<div class="space-y-2">
							<Label for="time_specific_price">{m.time_specific_price()}</Label>
							<Input
								id="time_specific_price"
								name="time_specific_price"
								type="number"
								step="0.01"
								min="0"
								value={profile.time_specific_price ?? 13}
							/>
							<p class="text-xs text-muted-foreground">{m.time_specific_price_desc()}</p>
						</div>
						<div class="space-y-2">
							<Label for="out_of_zone_base">{m.out_of_zone_base()}</Label>
							<Input
								id="out_of_zone_base"
								name="out_of_zone_base"
								type="number"
								step="0.01"
								min="0"
								value={profile.out_of_zone_base ?? 13}
							/>
							<p class="text-xs text-muted-foreground">{m.out_of_zone_base_desc()}</p>
						</div>
						<div class="space-y-2">
							<Label for="out_of_zone_per_km">{m.out_of_zone_per_km()}</Label>
							<Input
								id="out_of_zone_per_km"
								name="out_of_zone_per_km"
								type="number"
								step="0.01"
								min="0"
								value={profile.out_of_zone_per_km ?? 0.5}
							/>
							<p class="text-xs text-muted-foreground">{m.out_of_zone_per_km_desc()}</p>
						</div>
					</div>
					<Button type="submit">{m.action_save()}</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/key}
{/if}

<!-- Pricing Preferences -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Calculator class="size-5" />
			{m.settings_pricing_preferences()}
		</Card.Title>
		<Card.Description>{m.settings_pricing_preferences_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updatePricingPreferences" use:enhance class="space-y-6">
			<!-- Show price to courier toggle -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label>{m.settings_show_price_to_courier()}</Label>
					<p class="text-sm text-muted-foreground">{m.settings_show_price_to_courier_desc()}</p>
				</div>
				<input type="hidden" name="show_price_to_courier" value={showPriceToCourier.toString()} />
				<Switch
					checked={showPriceToCourier}
					onCheckedChange={(checked) => {
						showPriceToCourier = checked;
					}}
				/>
			</div>

			<Separator />

			<!-- Show price to client toggle -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label>{m.settings_show_price_to_client()}</Label>
					<p class="text-sm text-muted-foreground">{m.settings_show_price_to_client_desc()}</p>
				</div>
				<input type="hidden" name="show_price_to_client" value={showPriceToClient.toString()} />
				<Switch
					checked={showPriceToClient}
					onCheckedChange={(checked) => {
						showPriceToClient = checked;
					}}
				/>
			</div>

			<Separator />

			<!-- Default urgency fee -->
			<div class="space-y-2">
				<Label for="default_urgency_fee_id">{m.settings_default_urgency()}</Label>
				<select
					id="default_urgency_fee_id"
					name="default_urgency_fee_id"
					bind:value={defaultUrgencyFeeId}
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
				>
					<option value="">{m.none()}</option>
					{#each urgencyFees.filter((f) => f.active) as fee (fee.id)}
						<option value={fee.id}>{fee.name}</option>
					{/each}
				</select>
				<p class="text-xs text-muted-foreground">{m.settings_default_urgency_desc()}</p>
			</div>

			<!-- Minimum charge -->
			<div class="space-y-2">
				<Label for="minimum_charge">{m.settings_minimum_charge()}</Label>
				<Input
					id="minimum_charge"
					name="minimum_charge"
					type="number"
					min="0"
					step="0.01"
					bind:value={minimumCharge}
				/>
				<p class="text-xs text-muted-foreground">{m.settings_minimum_charge_desc()}</p>
			</div>

			<!-- Round distance -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label>{m.settings_round_distance()}</Label>
					<p class="text-sm text-muted-foreground">{m.settings_round_distance_desc()}</p>
				</div>
				<input type="hidden" name="round_distance" value={roundDistance.toString()} />
				<Switch
					checked={roundDistance}
					onCheckedChange={(checked) => {
						roundDistance = checked;
					}}
				/>
			</div>

			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

<!-- VAT Settings -->
<Card.Root>
	<Card.Header>
		<Card.Title class="flex items-center gap-2">
			<Receipt class="size-5" />
			{m.settings_vat_title()}
		</Card.Title>
		<Card.Description>{m.settings_vat_desc()}</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/updateVatSettings" use:enhance class="space-y-6">
			<!-- VAT enabled toggle -->
			<div class="flex items-center justify-between">
				<div class="space-y-0.5">
					<Label>{m.settings_vat_enabled()}</Label>
					<p class="text-sm text-muted-foreground">{m.settings_vat_enabled_desc()}</p>
				</div>
				<input type="hidden" name="vat_enabled" value={vatEnabled.toString()} />
				<Switch
					checked={vatEnabled}
					onCheckedChange={(checked) => {
						vatEnabled = checked;
					}}
				/>
			</div>

			{#if vatEnabled}
				<Separator />

				<!-- VAT rate input -->
				<div class="space-y-2">
					<Label for="vat_rate">{m.settings_vat_rate()}</Label>
					<Input
						id="vat_rate"
						name="vat_rate"
						type="number"
						min="0"
						max="100"
						step="0.01"
						bind:value={vatRate}
					/>
					<p class="text-xs text-muted-foreground">{m.settings_vat_rate_desc()}</p>
				</div>

				<Separator />

				<!-- Prices include VAT toggle -->
				<div class="flex items-center justify-between">
					<div class="space-y-0.5">
						<Label>{m.settings_prices_include_vat()}</Label>
						<p class="text-sm text-muted-foreground">{m.settings_prices_include_vat_desc()}</p>
					</div>
					<input type="hidden" name="prices_include_vat" value={pricesIncludeVat.toString()} />
					<Switch
						checked={pricesIncludeVat}
						onCheckedChange={(checked) => {
							pricesIncludeVat = checked;
						}}
					/>
				</div>
			{:else}
				<input type="hidden" name="vat_rate" value={vatRate.toString()} />
				<input type="hidden" name="prices_include_vat" value={pricesIncludeVat.toString()} />
			{/if}

			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

<!-- Urgency Fees -->
<Card.Root>
	<Card.Header>
		<div class="flex items-center justify-between">
			<div>
				<Card.Title class="flex items-center gap-2">
					<Zap class="size-5" />
					{m.settings_urgency_fees()}
				</Card.Title>
				<Card.Description>{m.settings_urgency_fees_desc()}</Card.Description>
			</div>
			<Button variant="outline" onclick={() => (showNewUrgencyForm = !showNewUrgencyForm)}>
				<Plus class="mr-2 size-4" />
				{m.settings_add_urgency()}
			</Button>
		</div>
	</Card.Header>
	<Card.Content class="space-y-4">
		{#if showNewUrgencyForm}
			<form method="POST" action="?/createUrgencyFee" use:enhance={() => { return async ({ result, update }) => { if (result.type === 'success') { showNewUrgencyForm = false; newUrgency = { name: '', description: '', multiplier: '1.0', flat_fee: '0' }; } await update(); }; }} class="space-y-4 rounded-lg border p-4">
				<h4 class="font-medium">{m.settings_new_urgency()}</h4>
				<div class="grid gap-4 md:grid-cols-2">
					<div class="space-y-2">
						<Label for="new_name">{m.form_name()}</Label>
						<Input id="new_name" name="name" bind:value={newUrgency.name} required />
					</div>
					<div class="space-y-2">
						<Label for="new_desc">{m.settings_description()}</Label>
						<Input id="new_desc" name="description" bind:value={newUrgency.description} />
					</div>
					<div class="space-y-2">
						<Label for="new_mult">{m.settings_multiplier()}</Label>
						<Input
							id="new_mult"
							name="multiplier"
							type="number"
							step="0.01"
							min="1"
							bind:value={newUrgency.multiplier}
						/>
						<p class="text-xs text-muted-foreground">{m.settings_multiplier_hint()}</p>
					</div>
					<div class="space-y-2">
						<Label for="new_flat">{m.settings_flat_fee()}</Label>
						<Input
							id="new_flat"
							name="flat_fee"
							type="number"
							step="0.01"
							min="0"
							bind:value={newUrgency.flat_fee}
						/>
					</div>
				</div>
				<div class="flex gap-2">
					<Button type="submit">{m.action_save()}</Button>
					<Button type="button" variant="outline" onclick={() => (showNewUrgencyForm = false)}>
						{m.action_cancel()}
					</Button>
				</div>
			</form>
		{/if}

		<div class="space-y-3">
			{#each urgencyFees as fee (fee.id)}
				<div class="rounded-lg border p-4 {fee.active ? '' : 'opacity-60'}">
					{#if editingFeeId === fee.id}
						<form method="POST" action="?/updateUrgencyFee" use:enhance={() => { return async ({ result, update }) => { if (result.type === 'success') { editingFeeId = null; } await update(); }; }}>
							<input type="hidden" name="id" value={fee.id} />
							<input type="hidden" name="active" value={fee.active.toString()} />
							<div class="grid gap-4 md:grid-cols-4">
								<div class="space-y-2">
									<Label>{m.form_name()}</Label>
									<Input name="name" value={fee.name} required />
								</div>
								<div class="space-y-2">
									<Label>{m.settings_description()}</Label>
									<Input name="description" value={fee.description || ''} />
								</div>
								<div class="space-y-2">
									<Label>{m.settings_multiplier()}</Label>
									<Input name="multiplier" type="number" step="0.01" min="1" value={fee.multiplier} />
								</div>
								<div class="space-y-2">
									<Label>{m.settings_flat_fee()}</Label>
									<Input name="flat_fee" type="number" step="0.01" min="0" value={fee.flat_fee} />
								</div>
							</div>
							<div class="mt-4 flex gap-2">
								<Button type="submit" size="sm">{m.action_save()}</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onclick={() => (editingFeeId = null)}
								>
									{m.action_cancel()}
								</Button>
							</div>
						</form>
					{:else}
						<div class="flex items-center justify-between">
							<div>
								<h4 class="font-medium">{fee.name}</h4>
								<p class="text-sm text-muted-foreground">{fee.description || '-'}</p>
							</div>
							<div class="flex items-center gap-2">
								<div class="mr-2 text-right">
									<p class="text-sm font-medium">{fee.multiplier}x + {fee.flat_fee.toFixed(2)}EUR</p>
									<p class="text-xs text-muted-foreground">
										{fee.active ? m.status_active() : m.settings_inactive()}
									</p>
								</div>
								<!-- Toggle active/inactive -->
								<form method="POST" action="?/toggleUrgencyFee" use:enhance>
									<input type="hidden" name="id" value={fee.id} />
									<input type="hidden" name="active" value={fee.active.toString()} />
									<Button
										type="submit"
										variant="ghost"
										size="icon"
										title={fee.active ? m.settings_deactivate() : m.settings_activate()}
									>
										<Power class="size-4 {fee.active ? 'text-green-500' : 'text-muted-foreground'}" />
									</Button>
								</form>
								<!-- Edit -->
								<Button variant="ghost" size="icon" onclick={() => (editingFeeId = fee.id)}>
									<span class="sr-only">{m.action_edit()}</span>
									<Pencil class="size-4" />
								</Button>
								<!-- Delete -->
								<Button
									variant="ghost"
									size="icon"
									class="text-destructive hover:text-destructive"
									onclick={() => openDeleteDialog(fee.id)}
								>
									<Trash2 class="size-4" />
								</Button>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</Card.Content>
</Card.Root>

<!-- Delete Confirmation Dialog -->
<AlertDialog.Root bind:open={deleteDialogOpen}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{m.settings_delete_urgency()}</AlertDialog.Title>
			<AlertDialog.Description>
				{m.settings_delete_urgency_desc()}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel onclick={() => (deleteDialogOpen = false)}>
				{m.action_cancel()}
			</AlertDialog.Cancel>
			<form method="POST" action="?/deleteUrgencyFee" use:enhance={() => { return async ({ update }) => { deleteDialogOpen = false; deletingFeeId = null; await update(); }; }} class="inline">
				<input type="hidden" name="id" value={deletingFeeId} />
				<AlertDialog.Action type="submit" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
					{m.action_delete()}
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
