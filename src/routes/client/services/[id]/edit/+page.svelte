<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import SchedulePicker from "$lib/components/SchedulePicker.svelte";
  import TimePreferencePicker from "$lib/components/TimePreferencePicker.svelte";
  import UrgencyFeeSelect from "$lib/components/UrgencyFeeSelect.svelte";
  import AddressInput from "$lib/components/AddressInput.svelte";
  import RouteMap from "$lib/components/RouteMap.svelte";
  import { type ServiceDistanceResult } from "$lib/services/distance.js";
  import { calculateRouteIfReady as calculateRouteShared } from "$lib/services/route.js";
  import {
    getCourierPricingSettings,
    type CourierPricingSettings,
  } from "$lib/services/pricing.js";
  import { isInDistributionZone } from "$lib/services/type-pricing.js";
  import { extractMunicipalityFromAddress } from "$lib/services/municipality.js";
  import { formatCurrency } from "$lib/utils.js";
  import * as m from "$lib/paraglide/messages.js";
  import { toast } from "$lib/utils/toast.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import type { PageData } from "./$types";
  import type { TimeSlot, UrgencyFee } from "$lib/database.types.js";
  import { PUBLIC_MAPBOX_TOKEN } from "$env/static/public";
  import { ArrowLeft } from "@lucide/svelte";

  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally - safe because {#key data.service.id} forces re-creation on navigation
  const service = data.service;
  const detailHref = localizeHref(`/client/services/${service.id}`);

  // Pre-populate from existing service
  let pickupLocation = $state(service.pickup_location);
  let deliveryLocation = $state(service.delivery_location);
  let notes = $state(service.notes || "");
  let recipientName = $state(service.recipient_name || "");
  let recipientPhone = $state(service.recipient_phone || "");
  let customerReference = $state(service.customer_reference || "");
  let loading = $state(false);

  // Coordinates for maps - pre-populate from service
  let pickupCoords = $state<[number, number] | null>(
    service.pickup_lng && service.pickup_lat
      ? [service.pickup_lng, service.pickup_lat]
      : null,
  );
  let deliveryCoords = $state<[number, number] | null>(
    service.delivery_lng && service.delivery_lat
      ? [service.delivery_lng, service.delivery_lat]
      : null,
  );
  let distanceKm = $state<number | null>(service.distance_km ?? null);
  let durationMinutes = $state<number | null>(null);
  let routeGeometry = $state<string | null>(null);
  let calculatingDistance = $state(false);
  let routeSource = $state<"api" | "haversine" | null>(null);

  // Distance breakdown for warehouse mode
  let distanceResult = $state<ServiceDistanceResult | null>(null);

  // Scheduling state - pre-populate
  let requestedDate = $state<string | null>(service.requested_date ?? null);
  let requestedTimeSlot = $state<TimeSlot | null>(
    (service.requested_time_slot as TimeSlot) ?? null,
  );
  let requestedTime = $state<string | null>(service.requested_time ?? null);

  // Urgency fees and pricing settings
  let urgencyFees = $state<UrgencyFee[]>([]);
  let selectedUrgencyFeeId = $state<string>(service.urgency_fee_id || "");
  let courierSettings = $state<CourierPricingSettings | null>(null);
  let settingsLoaded = $state(false);

  // Type-based pricing state
  let hasTimePreference = $state(
    !!service.has_time_preference || !!service.requested_time_slot,
  );

  // Delivery zone state - pre-populate from service
  let deliveryIsOutOfZone = $state<boolean | null>(
    service.is_out_of_zone ?? null,
  );
  let deliveryDetectedMunicipality = $state<string | null>(
    service.detected_municipality ?? null,
  );
  let checkingDeliveryZone = $state(false);
  // svelte-ignore state_referenced_locally - intentional: captures if delivery address was pre-populated
  let deliveryAddressSelected = $state(!!deliveryLocation);

  // Pickup zone state - pre-populate from service
  let pickupIsOutOfZone = $state<boolean | null>(
    service.pickup_is_out_of_zone ?? null,
  );
  let pickupDetectedMunicipality = $state<string | null>(
    service.pickup_detected_municipality ?? null,
  );
  let checkingPickupZone = $state(false);
  // svelte-ignore state_referenced_locally - intentional: captures if pickup address was pre-populated
  let pickupAddressSelected = $state(!!pickupLocation);

  // Combined: if EITHER pickup OR delivery is out of zone
  const isOutOfZone = $derived(
    pickupIsOutOfZone === true || deliveryIsOutOfZone === true,
  );

  // Derived: is type-based pricing mode
  const isTypePricingMode = $derived(data.pricingMode === "type");

  // Whether to show address autocomplete (only if Mapbox is configured)
  const hasMapbox = !!PUBLIC_MAPBOX_TOKEN;

  // Load courier settings and urgency fees on mount
  $effect(() => {
    if (!settingsLoaded) {
      loadSettings();
    }
  });

  async function loadSettings() {
    const [settings, { data: fees }] = await Promise.all([
      getCourierPricingSettings(data.supabase),
      data.supabase
        .from("urgency_fees")
        .select("*")
        .eq("active", true)
        .order("sort_order"),
    ]);
    courierSettings = settings;
    urgencyFees = (fees || []) as UrgencyFee[];
    if (!service.urgency_fee_id) {
      selectedUrgencyFeeId = settings.defaultUrgencyFeeId || "";
    }
    settingsLoaded = true;

    // Recalculate route on load if coords exist
    if (pickupCoords && deliveryCoords) {
      calculateDistanceIfReady();
    }
  }

  async function handlePickupSelect(
    address: string,
    coords: [number, number] | null,
  ) {
    pickupLocation = address;
    pickupCoords = coords;
    pickupAddressSelected = true;
    calculateDistanceIfReady();

    // If type-based pricing, detect municipality and check zone for pickup
    if (isTypePricingMode && address) {
      await detectPickupZone(address);
    }
  }

  async function handleDeliverySelect(
    address: string,
    coords: [number, number] | null,
  ) {
    deliveryLocation = address;
    deliveryCoords = coords;
    deliveryAddressSelected = true;
    calculateDistanceIfReady();

    // If type-based pricing, detect municipality and check zone for delivery
    if (isTypePricingMode && address) {
      await detectDeliveryZone(address);
    }
  }

  // Clear coordinates when addresses are emptied (handles case where user clears the field)
  $effect(() => {
    if (!pickupLocation) {
      pickupCoords = null;
    }
  });
  $effect(() => {
    if (!deliveryLocation) {
      deliveryCoords = null;
    }
  });

  /**
   * Extract municipality (concelho) from Mapbox address and check if pickup is in zone
   */
  async function detectPickupZone(address: string) {
    checkingPickupZone = true;

    const municipality = extractMunicipalityFromAddress(address);
    pickupDetectedMunicipality = municipality;

    if (municipality) {
      const inZone = await isInDistributionZone(data.supabase, municipality);
      pickupIsOutOfZone = !inZone;
    } else {
      pickupIsOutOfZone = null;
    }

    checkingPickupZone = false;
  }

  /**
   * Extract municipality (concelho) from Mapbox address and check if delivery is in zone
   */
  async function detectDeliveryZone(address: string) {
    checkingDeliveryZone = true;

    const municipality = extractMunicipalityFromAddress(address);
    deliveryDetectedMunicipality = municipality;

    if (municipality) {
      const inZone = await isInDistributionZone(data.supabase, municipality);
      deliveryIsOutOfZone = !inZone;
    } else {
      deliveryIsOutOfZone = null;
    }

    checkingDeliveryZone = false;
  }

  async function calculateDistanceIfReady() {
    calculatingDistance = true;
    const result = await calculateRouteShared(
      pickupCoords,
      deliveryCoords,
      courierSettings,
    );
    distanceKm = result.distanceKm;
    durationMinutes = result.durationMinutes;
    routeGeometry = result.routeGeometry;
    distanceResult = result.distanceResult;
    routeSource = result.source;
    calculatingDistance = false;
  }

  function handleFormSubmit() {
    loading = true;
    return async ({
      result,
    }: {
      result: { type: string; data?: { error?: string } };
    }) => {
      if (result.type === "failure" && result.data?.error) {
        toast.error(m.toast_error_generic(), { duration: 8000 });
        loading = false;
      } else if (result.type === "redirect") {
        toast.success(m.toast_service_updated());
        // Redirect is handled automatically by SvelteKit
      } else {
        loading = false;
      }
    };
  }
</script>

<!-- Force component re-creation when navigating between different services -->
{#key data.service.id}
  <div class="max-w-md mx-auto space-y-6">
    <div class="flex items-center gap-3">
      <Button variant="ghost" size="sm" href={detailHref}>
        <ArrowLeft class="size-4" />
      </Button>
      <div>
        <h1 class="text-2xl font-bold">{m.edit_service_title()}</h1>
        <p class="text-muted-foreground">{m.edit_service_description()}</p>
      </div>
    </div>

    <Card.Root>
      <Card.Content class="pt-6">
        <form method="POST" use:enhance={handleFormSubmit} class="space-y-4">
          <div class="space-y-2">
            <Label for="pickup">{m.form_pickup_location()}</Label>
            {#if hasMapbox}
              <AddressInput
                id="pickup"
                bind:value={pickupLocation}
                onSelect={handlePickupSelect}
                placeholder={m.form_pickup_placeholder()}
                disabled={loading}
              />
            {:else}
              <Input
                id="pickup"
                type="text"
                placeholder={m.form_pickup_placeholder()}
                bind:value={pickupLocation}
                required
                disabled={loading}
              />
            {/if}
            <!-- Zone status indicator for pickup (type-based pricing only) -->
            {#if isTypePricingMode && pickupAddressSelected}
              {#if checkingPickupZone}
                <p class="text-sm text-muted-foreground">
                  {m.loading()}
                </p>
              {:else if pickupIsOutOfZone === true}
                <div
                  class="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="mt-0.5 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <div>
                    <p class="font-medium">{m.out_of_zone_warning()}</p>
                    <p class="text-xs mt-1">{m.out_of_zone_client_warning()}</p>
                  </div>
                </div>
              {:else if pickupIsOutOfZone === false}
                <div
                  class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <p>{m.in_zone()}</p>
                </div>
              {/if}
            {/if}
          </div>

          <div class="space-y-2">
            <Label for="delivery">{m.form_delivery_location()}</Label>
            {#if hasMapbox}
              <AddressInput
                id="delivery"
                bind:value={deliveryLocation}
                onSelect={handleDeliverySelect}
                placeholder={m.form_delivery_placeholder()}
                disabled={loading}
              />
            {:else}
              <Input
                id="delivery"
                type="text"
                placeholder={m.form_delivery_placeholder()}
                bind:value={deliveryLocation}
                required
                disabled={loading}
              />
            {/if}
            <!-- Zone status indicator for delivery (type-based pricing only) -->
            {#if isTypePricingMode && deliveryAddressSelected}
              {#if checkingDeliveryZone}
                <p class="text-sm text-muted-foreground">
                  {m.loading()}
                </p>
              {:else if deliveryIsOutOfZone === true}
                <div
                  class="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="mt-0.5 shrink-0"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 8v4" />
                    <path d="M12 16h.01" />
                  </svg>
                  <div>
                    <p class="font-medium">{m.out_of_zone_warning()}</p>
                    <p class="text-xs mt-1">{m.out_of_zone_client_warning()}</p>
                  </div>
                </div>
              {:else if deliveryIsOutOfZone === false}
                <div
                  class="flex items-center gap-2 text-sm text-green-700 dark:text-green-400"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  <p>{m.in_zone()}</p>
                </div>
              {/if}
            {/if}
          </div>

          <!-- Show map preview if both addresses are selected -->
          {#if hasMapbox && pickupCoords && deliveryCoords}
            <div class="space-y-2">
              <Label>{m.map_route()}</Label>
              <RouteMap
                {pickupCoords}
                {deliveryCoords}
                {routeGeometry}
                {distanceKm}
                {durationMinutes}
                height="200px"
              />
              {#if calculatingDistance}
                <p class="text-sm text-muted-foreground">
                  {m.map_calculating()}
                </p>
              {:else if routeSource === "haversine" && distanceKm !== null}
                <p class="text-sm text-amber-600">
                  {m.route_calculation_fallback()}
                </p>
              {/if}
            </div>
          {/if}

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

          <Separator />

          <!-- Recipient Section -->
          <div class="space-y-4">
            <h3 class="text-sm font-medium text-muted-foreground">
              {m.recipient_optional()}
            </h3>
            <div class="grid gap-4 sm:grid-cols-2">
              <div class="space-y-2">
                <Label for="recipient_name">{m.recipient_name()}</Label>
                <Input
                  id="recipient_name"
                  name="recipient_name"
                  bind:value={recipientName}
                  placeholder={m.recipient_name_placeholder()}
                  disabled={loading}
                />
              </div>
              <div class="space-y-2">
                <Label for="recipient_phone">{m.recipient_phone()}</Label>
                <Input
                  id="recipient_phone"
                  name="recipient_phone"
                  type="tel"
                  bind:value={recipientPhone}
                  placeholder={m.recipient_phone_placeholder()}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          <!-- Customer Reference -->
          <div class="space-y-2">
            <Label for="customer_reference">{m.customer_reference()}</Label>
            <Input
              id="customer_reference"
              name="customer_reference"
              bind:value={customerReference}
              placeholder={m.customer_reference_placeholder()}
              disabled={loading}
            />
            <p class="text-xs text-muted-foreground">
              {m.customer_reference_help()}
            </p>
          </div>

          <Separator />

          <!-- Schedule / Time Preference -->
          <div class="space-y-2">
            {#if isTypePricingMode}
              <!-- Use TimePreferencePicker for type-based pricing -->
              <h3 class="font-medium text-sm text-muted-foreground">
                {m.schedule_optional()}
              </h3>
              <TimePreferencePicker
                selectedDate={requestedDate}
                selectedTimeSlot={requestedTimeSlot}
                selectedTime={requestedTime}
                onDateChange={(date) => (requestedDate = date)}
                onTimeSlotChange={(slot) => {
                  requestedTimeSlot = slot;
                  hasTimePreference = slot !== null;
                }}
                onTimeChange={(time) => (requestedTime = time)}
                disabled={loading}
                showPriceWarning={true}
                basePrice={data.clientServiceType?.price ?? 0}
                timePreferencePrice={data.typePricingSettings.timeSpecificPrice}
                isOutOfZone={isOutOfZone === true}
              />
            {:else}
              <!-- Use traditional SchedulePicker -->
              <h3 class="font-medium text-sm text-muted-foreground">
                {m.schedule_optional()}
              </h3>
              <SchedulePicker
                selectedDate={requestedDate}
                selectedTimeSlot={requestedTimeSlot}
                selectedTime={requestedTime}
                onDateChange={(date) => (requestedDate = date)}
                onTimeSlotChange={(slot) => (requestedTimeSlot = slot)}
                onTimeChange={(time) => (requestedTime = time)}
                disabled={loading}
              />
            {/if}
          </div>

          <!-- Urgency fee selection (only for non-type-based pricing) -->
          {#if !isTypePricingMode && settingsLoaded}
            <Separator />
            <div class="space-y-2">
              <Label for="urgency">{m.form_urgency()}</Label>
              <UrgencyFeeSelect
                fees={urgencyFees}
                bind:value={selectedUrgencyFeeId}
                disabled={loading}
              />
            </div>
          {/if}

          <!-- Distance breakdown for warehouse mode (only for non-type-based pricing) -->
          {#if !isTypePricingMode && distanceResult?.distanceMode === "warehouse" && distanceResult.warehouseToPickupKm}
            <div class="rounded-md bg-muted p-3 text-sm space-y-1">
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{m.distance_warehouse_to_pickup()}</span
                >
                <span>{distanceResult.warehouseToPickupKm} km</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted-foreground"
                  >{m.distance_pickup_to_delivery()}</span
                >
                <span>{distanceResult.pickupToDeliveryKm} km</span>
              </div>
              <Separator />
              <div class="flex justify-between font-medium">
                <span>{m.distance_total()}</span>
                <span>{distanceResult.totalDistanceKm} km</span>
              </div>
            </div>
          {/if}

          <!-- Price Estimate (only if type-based pricing and show_price_to_client is true) -->
          {#if isTypePricingMode && data.showPriceToClient && data.typePricingSettings}
            <Separator />
            <div class="rounded-md bg-muted/50 p-4 space-y-2">
              <p class="text-sm font-medium">{m.price_estimate()}</p>

              <!-- Service type name -->
              {#if data.clientServiceType?.name}
                <p class="text-sm text-muted-foreground">
                  {m.service_type()}:
                  <span class="font-medium text-foreground"
                    >{data.clientServiceType.name}</span
                  >
                </p>
              {/if}

              {#if isOutOfZone === true}
                <p class="text-lg font-bold text-amber-600">
                  {formatCurrency(data.typePricingSettings.outOfZoneBase)} + {m.distance_charge()}
                </p>
                <p class="text-xs text-muted-foreground">
                  {m.out_of_zone_client_warning()}
                </p>
                <p class="text-xs text-muted-foreground italic">
                  {m.price_final_note()}
                </p>
              {:else if hasTimePreference}
                <p class="text-lg font-bold">
                  {formatCurrency(data.typePricingSettings.timeSpecificPrice)}
                </p>
                <p class="text-xs text-muted-foreground italic">
                  {m.price_final_note()}
                </p>
              {:else if data.clientServiceType}
                <p class="text-lg font-bold">
                  {formatCurrency(data.clientServiceType.price)}
                </p>
                <p class="text-xs text-muted-foreground italic">
                  {m.price_final_note()}
                </p>
              {:else}
                <p class="text-muted-foreground text-sm">
                  {m.price_final_note()}
                </p>
              {/if}
            </div>
          {/if}

          <!-- Hidden fields for form submission -->
          <input type="hidden" name="pickup_location" value={pickupLocation} />
          <input
            type="hidden"
            name="delivery_location"
            value={deliveryLocation}
          />
          <input type="hidden" name="notes" value={notes} />
          <input type="hidden" name="recipient_name" value={recipientName} />
          <input type="hidden" name="recipient_phone" value={recipientPhone} />
          <input
            type="hidden"
            name="customer_reference"
            value={customerReference}
          />
          <input
            type="hidden"
            name="pickup_lat"
            value={pickupCoords?.[1] ?? ""}
          />
          <input
            type="hidden"
            name="pickup_lng"
            value={pickupCoords?.[0] ?? ""}
          />
          <input
            type="hidden"
            name="delivery_lat"
            value={deliveryCoords?.[1] ?? ""}
          />
          <input
            type="hidden"
            name="delivery_lng"
            value={deliveryCoords?.[0] ?? ""}
          />
          <input
            type="hidden"
            name="requested_date"
            value={requestedDate ?? ""}
          />
          <input
            type="hidden"
            name="requested_time_slot"
            value={requestedTimeSlot ?? ""}
          />
          <input
            type="hidden"
            name="requested_time"
            value={requestedTime ?? ""}
          />
          <input
            type="hidden"
            name="urgency_fee_id"
            value={selectedUrgencyFeeId}
          />

          <!-- Type-based pricing hidden fields -->
          {#if isTypePricingMode}
            <input
              type="hidden"
              name="has_time_preference"
              value={hasTimePreference}
            />
            <!-- Delivery zone fields -->
            <input
              type="hidden"
              name="is_out_of_zone"
              value={deliveryIsOutOfZone ?? false}
            />
            <input
              type="hidden"
              name="detected_municipality"
              value={deliveryDetectedMunicipality ?? ""}
            />
            <!-- Pickup zone fields -->
            <input
              type="hidden"
              name="pickup_is_out_of_zone"
              value={pickupIsOutOfZone ?? false}
            />
            <input
              type="hidden"
              name="pickup_detected_municipality"
              value={pickupDetectedMunicipality ?? ""}
            />
          {/if}

          <div class="flex gap-2 pt-2">
            <Button variant="outline" class="flex-1" href={detailHref}>
              {m.services_cancel()}
            </Button>
            <Button
              type="submit"
              class="flex-1"
              disabled={loading ||
                !pickupLocation ||
                !deliveryLocation ||
                (requestedTimeSlot === "specific" && !requestedTime)}
            >
              {loading ? m.saving() : m.edit_service_save()}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>
  </div>
{/key}
