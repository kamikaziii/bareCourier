<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Label } from '$lib/components/ui/label/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import type { PricingModel, ClientPricing, PricingZone } from '$lib/database.types.js';
	import { Euro, Trash2, Plus } from '@lucide/svelte';

	interface PricingConfig {
		pricing_model: PricingModel;
		base_fee: number;
		per_km_rate: number;
	}

	interface ZoneConfig {
		min_km: number;
		max_km: number | null;
		price: number;
	}

	interface Props {
		existingConfig?: ClientPricing | null;
		existingZones?: PricingZone[];
		onSave: (config: PricingConfig, zones: ZoneConfig[]) => Promise<void>;
		compact?: boolean;
	}

	let { existingConfig = null, existingZones = [], onSave, compact = false }: Props = $props();

	// State for pricing form
	let pricingModel = $state<PricingModel>(existingConfig?.pricing_model || 'per_km');
	let baseFee = $state(existingConfig?.base_fee?.toString() || '0');
	let perKmRate = $state(existingConfig?.per_km_rate?.toString() || '0');
	let saving = $state(false);
	let error = $state('');

	// State for zones (for zone pricing)
	let zones = $state<ZoneConfig[]>(
		existingZones.length > 0
			? existingZones.map((z) => ({ min_km: z.min_km, max_km: z.max_km, price: z.price }))
			: [
					{ min_km: 0, max_km: 5, price: 3 },
					{ min_km: 5, max_km: 10, price: 5 },
					{ min_km: 10, max_km: 20, price: 8 },
					{ min_km: 20, max_km: null, price: 12 }
				]
	);

	// Zone validation
	type ZoneError = { index: number; message: string };
	let zoneErrors = $state<ZoneError[]>([]);

	function addZone() {
		const lastZone = zones[zones.length - 1];
		const newMinKm = lastZone?.max_km || 0;
		zones = [...zones, { min_km: newMinKm, max_km: newMinKm + 10, price: 0 }];
	}

	function removeZone(index: number) {
		zones = zones.filter((_, i) => i !== index);
	}

	function validateZones(): boolean {
		const errors: ZoneError[] = [];

		// Sort zones by min_km for validation
		const sortedZones = [...zones].sort((a, b) => a.min_km - b.min_km);

		for (let i = 0; i < sortedZones.length; i++) {
			const zone = sortedZones[i];
			const originalIndex = zones.findIndex(
				(z) => z.min_km === zone.min_km && z.max_km === zone.max_km && z.price === zone.price
			);

			// Check for negative values
			if (zone.min_km < 0) {
				errors.push({ index: originalIndex, message: m.billing_zone_error_negative() });
			}

			// Check min < max (if max is set)
			if (zone.max_km !== null && zone.min_km >= zone.max_km) {
				errors.push({ index: originalIndex, message: m.billing_zone_error_min_max() });
			}

			// Check for gaps with next zone
			if (i < sortedZones.length - 1) {
				const nextZone = sortedZones[i + 1];
				if (zone.max_km !== null && zone.max_km < nextZone.min_km) {
					errors.push({ index: originalIndex, message: m.billing_zone_error_gap() });
				}
			}

			// Check for overlaps with next zone
			if (i < sortedZones.length - 1) {
				const nextZone = sortedZones[i + 1];
				if (zone.max_km === null || zone.max_km > nextZone.min_km) {
					errors.push({ index: originalIndex, message: m.billing_zone_error_overlap() });
				}
			}
		}

		// Only one zone can have unlimited max (null)
		const unlimitedZones = zones.filter((z) => z.max_km === null);
		if (unlimitedZones.length > 1) {
			const lastUnlimited = zones.findIndex((z) => z.max_km === null);
			errors.push({ index: lastUnlimited, message: m.billing_zone_error_multiple_unlimited() });
		}

		zoneErrors = errors;
		return errors.length === 0;
	}

	function getZoneError(index: number): string | undefined {
		return zoneErrors.find((e) => e.index === index)?.message;
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();

		if (pricingModel === 'zone' && !validateZones()) {
			return;
		}

		saving = true;
		error = '';

		try {
			const config: PricingConfig = {
				pricing_model: pricingModel,
				base_fee: parseFloat(baseFee) || 0,
				per_km_rate: parseFloat(perKmRate) || 0
			};

			await onSave(config, pricingModel === 'zone' ? zones : []);
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save';
		} finally {
			saving = false;
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	{#if error}
		<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
			{error}
		</div>
	{/if}

	<div class="space-y-2">
		<Label for="pricing_model">{m.billing_pricing_model()}</Label>
		<select
			id="pricing_model"
			bind:value={pricingModel}
			class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
		>
			<option value="per_km">{m.billing_model_per_km()}</option>
			<option value="flat_plus_km">{m.billing_model_flat_plus_km()}</option>
			<option value="zone">{m.billing_model_zone()}</option>
		</select>
	</div>

	{#if pricingModel !== 'zone'}
		<div class="grid gap-4 {compact ? '' : 'md:grid-cols-2'}">
			<div class="space-y-2">
				<Label for="base_fee">{m.billing_base_fee()}</Label>
				<div class="relative">
					<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
					<Input
						id="base_fee"
						type="number"
						step="0.01"
						min="0"
						bind:value={baseFee}
						class="pl-9"
					/>
				</div>
			</div>
			<div class="space-y-2">
				<Label for="per_km_rate">{m.billing_per_km_rate()}</Label>
				<div class="relative">
					<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
					<Input
						id="per_km_rate"
						type="number"
						step="0.01"
						min="0"
						bind:value={perKmRate}
						class="pl-9"
					/>
				</div>
			</div>
		</div>
	{:else}
		<!-- Zone Configuration -->
		<div class="space-y-3">
			<Label>{m.billing_zones()}</Label>
			<p class="text-xs text-muted-foreground">{m.billing_zones_desc()}</p>

			{#if zoneErrors.length > 0}
				<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
					{m.billing_zone_errors()}
				</div>
			{/if}

			<div class="space-y-3">
				{#each zones as zone, index (index)}
					<div class="space-y-1">
						<div class="flex items-center gap-2">
							<Input
								type="number"
								step="0.1"
								min="0"
								bind:value={zone.min_km}
								placeholder="Min km"
								class="w-20 {getZoneError(index) ? 'border-destructive' : ''}"
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
								class="w-28 {getZoneError(index) ? 'border-destructive' : ''}"
							/>
							<span class="text-muted-foreground">km =</span>
							<div class="relative flex-1">
								<Euro class="absolute left-3 top-3 size-4 text-muted-foreground" />
								<Input type="number" step="0.01" min="0" bind:value={zone.price} class="pl-9" />
							</div>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onclick={() => removeZone(index)}
								disabled={zones.length <= 1}
							>
								<Trash2 class="size-4" />
							</Button>
						</div>
						{#if getZoneError(index)}
							<p class="text-xs text-destructive">{getZoneError(index)}</p>
						{/if}
					</div>
				{/each}
			</div>

			<Button type="button" variant="outline" size="sm" onclick={addZone}>
				<Plus class="mr-2 size-4" />
				{m.billing_add_zone()}
			</Button>
		</div>
	{/if}

	<Button type="submit" disabled={saving}>
		{saving ? m.saving() : m.action_save()}
	</Button>
</form>
