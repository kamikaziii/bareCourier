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
	import { Zap, Plus, Trash2, Power, MapPin, Warehouse, Calculator, Pencil } from '@lucide/svelte';
	import type { Profile, UrgencyFee } from '$lib/database.types.js';

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

	// Pricing mode state
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let pricingMode = $state<'warehouse' | 'zone'>(profile.pricing_mode ?? 'warehouse');

	// Pricing preferences state
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let showPriceToCourier = $state(profile.show_price_to_courier ?? true);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let showPriceToClient = $state(profile.show_price_to_client ?? true);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let defaultUrgencyFeeId = $state<string | null>(profile.default_urgency_fee_id || null);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let minimumCharge = $state(profile.minimum_charge ?? 0);
	// svelte-ignore state_referenced_locally - intentional: capture initial value for form
	let roundDistance = $state(profile.round_distance ?? false);

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
			</div>
			<Button type="submit">{m.action_save()}</Button>
		</form>
	</Card.Content>
</Card.Root>

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
					class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
			<form method="POST" action="?/createUrgencyFee" use:enhance class="space-y-4 rounded-lg border p-4">
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
						<form method="POST" action="?/updateUrgencyFee" use:enhance>
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
			<form method="POST" action="?/deleteUrgencyFee" use:enhance class="inline">
				<input type="hidden" name="id" value={deletingFeeId} />
				<AlertDialog.Action type="submit" class="bg-destructive text-destructive-foreground hover:bg-destructive/90">
					{m.action_delete()}
				</AlertDialog.Action>
			</form>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
