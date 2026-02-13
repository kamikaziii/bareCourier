<script lang="ts">
  import { enhance, applyAction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
  import { formatCurrency } from "$lib/utils.js";
  import {
    Zap,
    Plus,
    Trash2,
    Power,
    MapPin,
    Warehouse,
    Calculator,
    Pencil,
    Receipt,
    Package,
  } from "@lucide/svelte";
  import type {
    Profile,
    UrgencyFee,
    ServiceType,
  } from "$lib/database.types.js";

  /** Portuguese standard VAT rate (%) */
  const DEFAULT_VAT_RATE = 23;

  interface Props {
    profile: Profile;
    urgencyFees: UrgencyFee[];
    serviceTypes: ServiceType[];
    clientsWithoutServiceType: number;
  }

  let { profile, urgencyFees, serviceTypes, clientsWithoutServiceType }: Props =
    $props();

  // State for urgency fees
  let showNewUrgencyForm = $state(false);
  let newUrgency = $state({
    name: "",
    description: "",
    multiplier: "1.0",
    flat_fee: "0",
  });

  // Editable urgency fees state
  let editingFeeId = $state<string | null>(null);

  // Delete confirmation state
  let deletingFeeId = $state<string | null>(null);
  let deleteDialogOpen = $state(false);

  // Form state - Initialize with default values, sync with props in $effect
  // Using $state because these values are bound to form inputs (bind:value/bind:group)
  let pricingMode = $state<"warehouse" | "zone" | "type">("warehouse");
  let showPriceToCourier = $state(true);
  let showPriceToClient = $state(true);
  let defaultUrgencyFeeId = $state<string>("");
  let minimumCharge = $state(0);
  let roundDistance = $state(false);
  let vatEnabled = $state(false);
  let vatRate = $state(DEFAULT_VAT_RATE);
  let pricesIncludeVat = $state(false);

  // Special pricing (type-based mode)
  let timeSpecificPrice = $state(13);
  let outOfZoneBase = $state(13);
  let outOfZonePerKm = $state(0.5);

  // Sync all form state with props (runs on mount and when profile changes)
  $effect(() => {
    pricingMode =
      (profile.pricing_mode as "warehouse" | "zone" | "type") ?? "warehouse";
    showPriceToCourier = profile.show_price_to_courier ?? true;
    showPriceToClient = profile.show_price_to_client ?? true;
    defaultUrgencyFeeId = profile.default_urgency_fee_id || "";
    minimumCharge = profile.minimum_charge ?? 0;
    roundDistance = profile.round_distance ?? false;
    vatEnabled = profile.vat_enabled ?? false;
    vatRate = profile.vat_rate ?? DEFAULT_VAT_RATE;
    pricesIncludeVat = profile.prices_include_vat ?? false;
    timeSpecificPrice = profile.time_specific_price ?? 13;
    outOfZoneBase = profile.out_of_zone_base ?? 13;
    outOfZonePerKm = profile.out_of_zone_per_km ?? 0.5;
  });

  // Pricing mode switch safeguard state
  let switchDialogOpen = $state(false);
  let bulkAssignTypeId = $state("");
  let bulkAssigning = $state(false);
  let pricingModeFormEl = $state<HTMLFormElement | null>(null);

  async function handleAssignAndSwitch() {
    if (!bulkAssignTypeId) return;
    bulkAssigning = true;

    try {
      const formData = new FormData();
      formData.set("service_type_id", bulkAssignTypeId);

      const response = await fetch("?/bulkAssignServiceType", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();
      if (result.type === "success" || result.data?.success) {
        toast.success(
          m.toast_bulk_assign_success({
            count: clientsWithoutServiceType.toString(),
          }),
        );
        await invalidateAll();
      } else {
        toast.error(m.toast_bulk_assign_failed(), { duration: 8000 });
        bulkAssigning = false;
        return;
      }
    } catch {
      toast.error(m.toast_bulk_assign_failed(), { duration: 8000 });
      bulkAssigning = false;
      return;
    }

    bulkAssigning = false;
    switchDialogOpen = false;

    // Now submit the pricing mode form
    pricingModeFormEl?.requestSubmit();
  }

  function handleSwitchWithoutAssigning() {
    switchDialogOpen = false;
    // Submit the pricing mode form directly
    pricingModeFormEl?.requestSubmit();
  }

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
    <form
      bind:this={pricingModeFormEl}
      method="POST"
      action="?/updatePricingMode"
      use:enhance={async ({ cancel }) => {
        // Only intercept when switching TO type mode (not already in type)
        if (pricingMode === "type" && profile.pricing_mode !== "type") {
          if (serviceTypes.length === 0) {
            cancel();
            toast.error(m.toast_no_service_types(), { duration: 8000 });
            return;
          }
          if (clientsWithoutServiceType > 0) {
            cancel();
            bulkAssignTypeId = serviceTypes[0]?.id || "";
            switchDialogOpen = true;
            return;
          }
        }
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_pricing_saved());
          }
        };
      }}
      class="space-y-4"
    >
      <div class="space-y-3">
        <!-- Warehouse Option -->
        <label
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode ===
          'warehouse'
            ? 'border-primary bg-primary/5'
            : 'hover:bg-muted/50'}"
        >
          <input
            type="radio"
            name="pricing_mode"
            value="warehouse"
            bind:group={pricingMode}
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
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode ===
          'zone'
            ? 'border-primary bg-primary/5'
            : 'hover:bg-muted/50'}"
        >
          <input
            type="radio"
            name="pricing_mode"
            value="zone"
            bind:group={pricingMode}
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
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors {pricingMode ===
          'type'
            ? 'border-primary bg-primary/5'
            : 'hover:bg-muted/50'}"
        >
          <input
            type="radio"
            name="pricing_mode"
            value="type"
            bind:group={pricingMode}
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

{#if pricingMode === "type"}
  <!-- Special Pricing Settings -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <Calculator class="size-5" />
        {m.special_pricing()}
      </Card.Title>
      <Card.Description>{m.special_pricing_desc()}</Card.Description>
    </Card.Header>
    <Card.Content>
      <form
        method="POST"
        action="?/updateSpecialPricing"
        use:enhance={async () => {
          return async ({ result }) => {
            await applyAction(result);
            if (result.type === "success") {
              await invalidateAll();
              toast.success(m.toast_pricing_saved());
            }
          };
        }}
        class="space-y-4"
      >
        <div class="grid gap-4 md:grid-cols-3">
          <div class="space-y-2">
            <Label for="time_specific_price">{m.time_specific_price()}</Label>
            <Input
              id="time_specific_price"
              name="time_specific_price"
              type="number"
              step="0.01"
              min="0"
              bind:value={timeSpecificPrice}
            />
            <p class="text-xs text-muted-foreground">
              {m.time_specific_price_desc()}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="out_of_zone_base">{m.out_of_zone_base()}</Label>
            <Input
              id="out_of_zone_base"
              name="out_of_zone_base"
              type="number"
              step="0.01"
              min="0"
              bind:value={outOfZoneBase}
            />
            <p class="text-xs text-muted-foreground">
              {m.out_of_zone_base_desc()}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="out_of_zone_per_km">{m.out_of_zone_per_km()}</Label>
            <Input
              id="out_of_zone_per_km"
              name="out_of_zone_per_km"
              type="number"
              step="0.01"
              min="0"
              bind:value={outOfZonePerKm}
            />
            <p class="text-xs text-muted-foreground">
              {m.out_of_zone_per_km_desc()}
            </p>
          </div>
        </div>
        <Button type="submit">{m.action_save()}</Button>
      </form>
    </Card.Content>
  </Card.Root>
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
    <form
      method="POST"
      action="?/updatePricingPreferences"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_pricing_saved());
          }
        };
      }}
      class="space-y-6"
    >
      <!-- Show price to courier toggle -->
      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label>{m.settings_show_price_to_courier()}</Label>
          <p class="text-sm text-muted-foreground">
            {m.settings_show_price_to_courier_desc()}
          </p>
        </div>
        <input
          type="hidden"
          name="show_price_to_courier"
          value={showPriceToCourier.toString()}
        />
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
          <p class="text-sm text-muted-foreground">
            {m.settings_show_price_to_client_desc()}
          </p>
        </div>
        <input
          type="hidden"
          name="show_price_to_client"
          value={showPriceToClient.toString()}
        />
        <Switch
          checked={showPriceToClient}
          onCheckedChange={(checked) => {
            showPriceToClient = checked;
          }}
        />
      </div>

      {#if pricingMode !== "type"}
        <Separator />

        <!-- Default urgency fee (hidden for type-based pricing) -->
        <div class="space-y-2">
          <Label for="default_urgency_fee_id"
            >{m.settings_default_urgency()}</Label
          >
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
          <p class="text-xs text-muted-foreground">
            {m.settings_default_urgency_desc()}
          </p>
        </div>
      {:else}
        <!-- Preserve value when hidden -->
        <input type="hidden" name="default_urgency_fee_id" value="" />
      {/if}

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
        <p class="text-xs text-muted-foreground">
          {m.settings_minimum_charge_desc()}
        </p>
      </div>

      <!-- Round distance -->
      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label>{m.settings_round_distance()}</Label>
          <p class="text-sm text-muted-foreground">
            {m.settings_round_distance_desc()}
          </p>
        </div>
        <input
          type="hidden"
          name="round_distance"
          value={roundDistance.toString()}
        />
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
    <form
      method="POST"
      action="?/updateVatSettings"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_pricing_saved());
          }
        };
      }}
      class="space-y-6"
    >
      <!-- VAT enabled toggle -->
      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label>{m.settings_vat_enabled()}</Label>
          <p class="text-sm text-muted-foreground">
            {m.settings_vat_enabled_desc()}
          </p>
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
          <p class="text-xs text-muted-foreground">
            {m.settings_vat_rate_desc()}
          </p>
        </div>

        <Separator />

        <!-- Prices include VAT toggle -->
        <div class="flex items-center justify-between">
          <div class="space-y-0.5">
            <Label>{m.settings_prices_include_vat()}</Label>
            <p class="text-sm text-muted-foreground">
              {m.settings_prices_include_vat_desc()}
            </p>
          </div>
          <input
            type="hidden"
            name="prices_include_vat"
            value={pricesIncludeVat.toString()}
          />
          <Switch
            checked={pricesIncludeVat}
            onCheckedChange={(checked) => {
              pricesIncludeVat = checked;
            }}
          />
        </div>
      {:else}
        <input type="hidden" name="vat_rate" value={vatRate.toString()} />
        <input
          type="hidden"
          name="prices_include_vat"
          value={pricesIncludeVat.toString()}
        />
      {/if}

      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>

<!-- Urgency Fees (hidden for type-based pricing - redundant since time preference triggers premium) -->
{#if pricingMode !== "type"}
  <Card.Root>
    <Card.Header>
      <div
        class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <Card.Title class="flex items-center gap-2">
            <Zap class="size-5" />
            {m.settings_urgency_fees()}
          </Card.Title>
          <Card.Description>{m.settings_urgency_fees_desc()}</Card.Description>
        </div>
        <Button
          variant="outline"
          onclick={() => (showNewUrgencyForm = !showNewUrgencyForm)}
          class="w-full sm:w-auto"
        >
          <Plus class="mr-2 size-4" />
          {m.settings_add_urgency()}
        </Button>
      </div>
    </Card.Header>
    <Card.Content class="space-y-4">
      {#if showNewUrgencyForm}
        <form
          method="POST"
          action="?/createUrgencyFee"
          use:enhance={async () => {
            return async ({ result }) => {
              await applyAction(result);
              if (result.type === "success") {
                showNewUrgencyForm = false;
                newUrgency = {
                  name: "",
                  description: "",
                  multiplier: "1.0",
                  flat_fee: "0",
                };
                await invalidateAll();
                toast.success(m.toast_pricing_saved());
              }
            };
          }}
          class="space-y-4 rounded-lg border p-4"
        >
          <h4 class="font-medium">{m.settings_new_urgency()}</h4>
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="new_name">{m.form_name()}</Label>
              <Input
                id="new_name"
                name="name"
                bind:value={newUrgency.name}
                required
              />
            </div>
            <div class="space-y-2">
              <Label for="new_desc">{m.settings_description()}</Label>
              <Input
                id="new_desc"
                name="description"
                bind:value={newUrgency.description}
              />
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
              <p class="text-xs text-muted-foreground">
                {m.settings_multiplier_hint()}
              </p>
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
            <Button
              type="button"
              variant="outline"
              onclick={() => (showNewUrgencyForm = false)}
            >
              {m.action_cancel()}
            </Button>
          </div>
        </form>
      {/if}

      <div class="space-y-3">
        {#each urgencyFees as fee (fee.id)}
          <div class="rounded-lg border p-4 {fee.active ? '' : 'opacity-60'}">
            {#if editingFeeId === fee.id}
              <form
                method="POST"
                action="?/updateUrgencyFee"
                use:enhance={async () => {
                  return async ({ result }) => {
                    await applyAction(result);
                    if (result.type === "success") {
                      editingFeeId = null;
                      await invalidateAll();
                      toast.success(m.toast_pricing_saved());
                    }
                  };
                }}
              >
                <input type="hidden" name="id" value={fee.id} />
                <input
                  type="hidden"
                  name="active"
                  value={fee.active.toString()}
                />
                <div class="grid gap-4 md:grid-cols-4">
                  <div class="space-y-2">
                    <Label>{m.form_name()}</Label>
                    <Input name="name" value={fee.name} required />
                  </div>
                  <div class="space-y-2">
                    <Label>{m.settings_description()}</Label>
                    <Input name="description" value={fee.description || ""} />
                  </div>
                  <div class="space-y-2">
                    <Label>{m.settings_multiplier()}</Label>
                    <Input
                      name="multiplier"
                      type="number"
                      step="0.01"
                      min="1"
                      value={fee.multiplier}
                    />
                  </div>
                  <div class="space-y-2">
                    <Label>{m.settings_flat_fee()}</Label>
                    <Input
                      name="flat_fee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={fee.flat_fee}
                    />
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
              <div
                class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div class="min-w-0 flex-1">
                  <h4 class="font-medium">{fee.name}</h4>
                  <p class="truncate text-sm text-muted-foreground">
                    {fee.description || "-"}
                  </p>
                </div>
                <div
                  class="flex items-center justify-between gap-2 sm:justify-end"
                >
                  <div class="text-left sm:mr-2 sm:text-right">
                    <p class="text-sm font-medium">
                      {fee.multiplier}x + {formatCurrency(fee.flat_fee)}
                    </p>
                    <p class="text-xs text-muted-foreground">
                      {fee.active ? m.status_active() : m.settings_inactive()}
                    </p>
                  </div>
                  <div class="flex items-center gap-1">
                    <!-- Toggle active/inactive -->
                    <form
                      method="POST"
                      action="?/toggleUrgencyFee"
                      use:enhance={async () => {
                        return async ({ result }) => {
                          await applyAction(result);
                          if (result.type === "success") {
                            await invalidateAll();
                            toast.success(m.toast_pricing_saved());
                          }
                        };
                      }}
                    >
                      <input type="hidden" name="id" value={fee.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={fee.active.toString()}
                      />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        title={fee.active
                          ? m.settings_deactivate()
                          : m.settings_activate()}
                      >
                        <Power
                          class="size-4 {fee.active
                            ? 'text-green-500'
                            : 'text-muted-foreground'}"
                        />
                      </Button>
                    </form>
                    <!-- Edit -->
                    <Button
                      variant="ghost"
                      size="icon"
                      onclick={() => (editingFeeId = fee.id)}
                    >
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
        <form
          method="POST"
          action="?/deleteUrgencyFee"
          use:enhance={async () => {
            return async ({ result }) => {
              await applyAction(result);
              deleteDialogOpen = false;
              deletingFeeId = null;
              if (result.type === "success") {
                await invalidateAll();
                toast.success(m.toast_urgency_fee_deleted());
              }
            };
          }}
          class="inline"
        >
          <input type="hidden" name="id" value={deletingFeeId} />
          <AlertDialog.Action
            type="submit"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {m.action_delete()}
          </AlertDialog.Action>
        </form>
      </AlertDialog.Footer>
    </AlertDialog.Content>
  </AlertDialog.Root>
{/if}

<!-- Pricing Mode Switch Warning Dialog -->
<AlertDialog.Root bind:open={switchDialogOpen}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{m.pricing_switch_warning_title()}</AlertDialog.Title>
      <AlertDialog.Description>
        {m.pricing_switch_warning_desc({
          count: clientsWithoutServiceType.toString(),
        })}
      </AlertDialog.Description>
    </AlertDialog.Header>

    <div class="space-y-2 py-2">
      <Label for="bulk_assign_type">{m.pricing_switch_assign_label()}</Label>
      <select
        id="bulk_assign_type"
        bind:value={bulkAssignTypeId}
        class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        disabled={bulkAssigning}
      >
        {#each serviceTypes as type (type.id)}
          <option value={type.id}
            >{type.name} - {formatCurrency(Number(type.price))}</option
          >
        {/each}
      </select>
    </div>

    <AlertDialog.Footer>
      <AlertDialog.Cancel
        onclick={() => (switchDialogOpen = false)}
        disabled={bulkAssigning}
      >
        {m.action_cancel()}
      </AlertDialog.Cancel>
      <Button
        variant="outline"
        onclick={handleSwitchWithoutAssigning}
        disabled={bulkAssigning}
      >
        {m.pricing_switch_without_assigning()}
      </Button>
      <Button
        onclick={handleAssignAndSwitch}
        disabled={bulkAssigning || !bulkAssignTypeId}
      >
        {bulkAssigning ? m.loading() : m.pricing_switch_assign_and_switch()}
      </Button>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
