<script lang="ts">
  import { enhance } from "$app/forms";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import AddressInput from "$lib/components/AddressInput.svelte";
  import RouteMap from "$lib/components/RouteMap.svelte";
  import SchedulePicker from "$lib/components/SchedulePicker.svelte";
  import TimePreferencePicker from "$lib/components/TimePreferencePicker.svelte";
  import UrgencyFeeSelect from "$lib/components/UrgencyFeeSelect.svelte";
  import ZoneOverrideToggle from "$lib/components/ZoneOverrideToggle.svelte";
  import TypePricePreview from "$lib/components/TypePricePreview.svelte";
  import * as m from "$lib/paraglide/messages.js";
  import { formatCurrency } from "$lib/utils.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import { calculateRouteIfReady as calculateRouteShared } from "$lib/services/route.js";
  import { getCourierPricingSettings } from "$lib/services/pricing.js";
  import { isInDistributionZone } from "$lib/services/type-pricing.js";
  import { extractMunicipalityFromAddress } from "$lib/services/municipality.js";
  import type { PageData, ActionData } from "./$types";
  import type { TimeSlot, UrgencyFee } from "$lib/database.types.js";
  import { ArrowLeft } from "@lucide/svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // All form state captures initial values - safe because {#key data.service.id} forces re-creation on navigation
  // svelte-ignore state_referenced_locally
  let loading = $state(false);
  // svelte-ignore state_referenced_locally
  let clientId = $state(data.service.client_id);
  // svelte-ignore state_referenced_locally
  let pickupLocation = $state(data.service.pickup_location);
  // svelte-ignore state_referenced_locally
  let deliveryLocation = $state(data.service.delivery_location);
  // svelte-ignore state_referenced_locally
  let notes = $state(data.service.notes || "");
  // svelte-ignore state_referenced_locally
  let recipientName = $state(data.service.recipient_name || "");
  // svelte-ignore state_referenced_locally
  let recipientPhone = $state(data.service.recipient_phone || "");
  // svelte-ignore state_referenced_locally
  let customerReference = $state(data.service.customer_reference || "");

  // Coordinates and distance
  // svelte-ignore state_referenced_locally
  let pickupCoords = $state<[number, number] | null>(
    data.service.pickup_lng && data.service.pickup_lat
      ? [data.service.pickup_lng, data.service.pickup_lat]
      : null,
  );
  // svelte-ignore state_referenced_locally
  let deliveryCoords = $state<[number, number] | null>(
    data.service.delivery_lng && data.service.delivery_lat
      ? [data.service.delivery_lng, data.service.delivery_lat]
      : null,
  );
  let routeGeometry = $state<string | null>(null);
  // svelte-ignore state_referenced_locally
  let distanceKm = $state<number | null>(data.service.distance_km);
  let durationMinutes = $state<number | null>(null);
  let calculatingDistance = $state(false);

  // Schedule
  // svelte-ignore state_referenced_locally
  let scheduledDate = $state<string | null>(data.service.scheduled_date);
  // svelte-ignore state_referenced_locally
  let scheduledTimeSlot = $state<TimeSlot | null>(
    data.service.scheduled_time_slot as TimeSlot | null,
  );
  // svelte-ignore state_referenced_locally
  let scheduledTime = $state<string | null>(
    data.service.scheduled_time || null,
  );

  // Urgency fees
  let urgencyFees = $state<UrgencyFee[]>([]);
  // svelte-ignore state_referenced_locally
  let selectedUrgencyFeeId = $state<string>(data.service.urgency_fee_id || "");

  // Type-based pricing state
  // svelte-ignore state_referenced_locally
  let serviceTypeId = $state<string>(data.service.service_type_id || "");
  // svelte-ignore state_referenced_locally
  let tolls = $state<string>(data.service.tolls?.toString() || "");
  let hasTimePreference = $derived(!!scheduledTimeSlot);

  // Delivery zone state (existing, renamed for clarity)
  // svelte-ignore state_referenced_locally
  let deliveryIsOutOfZone = $state<boolean | null>(
    data.service.is_out_of_zone ?? null,
  );
  // svelte-ignore state_referenced_locally
  let deliveryDetectedMunicipality = $state<string | null>(
    data.service.detected_municipality || null,
  );
  let checkingDeliveryZone = $state(false);

  // Pickup zone state (new)
  // svelte-ignore state_referenced_locally
  let pickupIsOutOfZone = $state<boolean | null>(
    data.service.pickup_is_out_of_zone ?? null,
  );
  // svelte-ignore state_referenced_locally
  let pickupDetectedMunicipality = $state<string | null>(
    data.service.pickup_detected_municipality || null,
  );
  let checkingPickupZone = $state(false);

  // Combined: if EITHER pickup OR delivery is out of zone
  const isOutOfZone = $derived(
    pickupIsOutOfZone === true || deliveryIsOutOfZone === true,
  );

  const isTypePricingMode = $derived(data.pricingMode === "type");
  const selectedServiceType = $derived(
    data.serviceTypes?.find((t) => t.id === serviceTypeId) ?? null,
  );

  // Load urgency fees
  $effect(() => {
    data.supabase
      .from("urgency_fees")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data: fees }) => {
        urgencyFees = (fees || []) as UrgencyFee[];
      });
  });

  // Load initial route on mount if coords already exist (e.g. editing existing service)
  let hasMountedRoute = false;
  $effect(() => {
    if (!hasMountedRoute) {
      hasMountedRoute = true;
      if (pickupCoords && deliveryCoords) {
        calculateRouteIfReady();
      }
    }
  });

  function handleClientChange() {
    const client = data.clients.find((c) => c.id === clientId);
    if (client?.default_pickup_location && !pickupLocation) {
      pickupLocation = client.default_pickup_location;
    }
  }

  async function handlePickupSelect(
    address: string,
    coords: [number, number] | null,
  ) {
    pickupLocation = address;
    pickupCoords = coords;
    calculateRouteIfReady();

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
    calculateRouteIfReady();

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

  async function calculateRouteIfReady() {
    calculatingDistance = true;
    const settings = await getCourierPricingSettings(data.supabase);
    const result = await calculateRouteShared(
      pickupCoords,
      deliveryCoords,
      settings,
    );
    distanceKm = result.distanceKm;
    durationMinutes = result.durationMinutes;
    routeGeometry = result.routeGeometry;
    calculatingDistance = false;
  }
</script>

<!-- Force component re-creation when navigating between different services -->
{#key data.service.id}
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        href={localizeHref(`/courier/services/${data.service.id}`)}
      >
        <ArrowLeft class="size-4" />
      </Button>
      <h1 class="text-2xl font-bold">{m.edit_service()}</h1>
    </div>

    <Card.Root>
      <Card.Header>
        <Card.Title>{m.service_details()}</Card.Title>
        <Card.Description>{m.edit_service_desc()}</Card.Description>
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
            <div
              class="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              {form.error}
            </div>
          {/if}

          <div class="space-y-2">
            <Label for="client">{m.form_client()} *</Label>
            <select
              id="client"
              name="client_id"
              bind:value={clientId}
              onchange={handleClientChange}
              required
              disabled={loading}
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            >
              <option value="">{m.form_select_client()}</option>
              {#each data.clients as client (client.id)}
                <option value={client.id}>{client.name}</option>
              {/each}
            </select>
          </div>

          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="pickup">{m.form_pickup_location()} *</Label>
              <AddressInput
                id="pickup"
                bind:value={pickupLocation}
                onSelect={handlePickupSelect}
                placeholder={m.form_pickup_placeholder()}
                disabled={loading}
              />
              <!-- Zone status indicator with manual override for pickup (Type-based pricing only) -->
              {#if isTypePricingMode && pickupLocation}
                <ZoneOverrideToggle
                  isOutOfZone={pickupIsOutOfZone}
                  detectedMunicipality={pickupDetectedMunicipality}
                  checkingZone={checkingPickupZone}
                  onOverride={(outOfZone) => (pickupIsOutOfZone = outOfZone)}
                  disabled={loading}
                />
              {/if}
            </div>
            <div class="space-y-2">
              <Label for="delivery">{m.form_delivery_location()} *</Label>
              <AddressInput
                id="delivery"
                bind:value={deliveryLocation}
                onSelect={handleDeliverySelect}
                placeholder={m.form_delivery_placeholder()}
                disabled={loading}
              />
              <!-- Zone status indicator with manual override for delivery (Type-based pricing only) -->
              {#if isTypePricingMode && deliveryLocation}
                <ZoneOverrideToggle
                  isOutOfZone={deliveryIsOutOfZone}
                  detectedMunicipality={deliveryDetectedMunicipality}
                  checkingZone={checkingDeliveryZone}
                  onOverride={(outOfZone) => (deliveryIsOutOfZone = outOfZone)}
                  disabled={loading}
                />
              {/if}
            </div>
          </div>

          <!-- Route Map Preview -->
          {#if pickupCoords || deliveryCoords}
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
              {/if}
            </div>
          {/if}

          <!-- Type-based pricing fields -->
          {#if isTypePricingMode}
            <Separator />

            <!-- Service Type Selection -->
            <div class="space-y-2">
              <Label for="service_type">{m.service_type()} *</Label>
              <select
                id="service_type"
                bind:value={serviceTypeId}
                disabled={loading}
                class="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="">{m.form_select_service_type()}</option>
                {#each data.serviceTypes as type (type.id)}
                  <option value={type.id}
                    >{type.name} - {formatCurrency(type.price)}</option
                  >
                {/each}
              </select>
            </div>

            <!-- Tolls (only if either pickup or delivery is out of zone) -->
            {#if isOutOfZone === true}
              <div class="space-y-2">
                <Label for="tolls">{m.tolls_label()}</Label>
                <Input
                  id="tolls"
                  type="number"
                  step="0.01"
                  min="0"
                  bind:value={tolls}
                  placeholder={m.tolls_placeholder()}
                  disabled={loading}
                />
              </div>
            {/if}
          {/if}

          <Separator />

          <!-- Schedule / Time Preference -->
          <div class="space-y-2">
            {#if isTypePricingMode}
              <!-- Use TimePreferencePicker for type-based pricing -->
              <Label>{m.schedule_optional()}</Label>
              <TimePreferencePicker
                selectedDate={scheduledDate}
                selectedTimeSlot={scheduledTimeSlot}
                selectedTime={scheduledTime}
                onDateChange={(date) => (scheduledDate = date)}
                onTimeSlotChange={(slot) => (scheduledTimeSlot = slot)}
                onTimeChange={(time) => (scheduledTime = time)}
                disabled={loading}
                showPriceWarning={true}
                basePrice={selectedServiceType?.price ?? 0}
                timePreferencePrice={data.typePricingSettings.timeSpecificPrice}
                isOutOfZone={isOutOfZone === true}
              />
            {:else}
              <!-- Use traditional SchedulePicker -->
              <Label>{m.schedule_optional()}</Label>
              <SchedulePicker
                selectedDate={scheduledDate}
                selectedTimeSlot={scheduledTimeSlot}
                selectedTime={scheduledTime}
                onDateChange={(date) => (scheduledDate = date)}
                onTimeSlotChange={(slot) => (scheduledTimeSlot = slot)}
                onTimeChange={(time) => (scheduledTime = time)}
                disabled={loading}
              />
            {/if}
          </div>

          <!-- Urgency fee selection (only for distance-based pricing) -->
          {#if !isTypePricingMode}
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

          <!-- Live Price Preview (type-based pricing only) -->
          {#if isTypePricingMode && selectedServiceType && data.showPriceToCourier}
            <Separator />
            <TypePricePreview
              settings={data.typePricingSettings}
              serviceType={selectedServiceType}
              {isOutOfZone}
              {hasTimePreference}
              {distanceKm}
              tolls={tolls ? parseFloat(tolls) : null}
            />
          {/if}

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

          <div class="space-y-2">
            <Label for="notes">{m.form_notes_optional()}</Label>
            <Input
              id="notes"
              name="notes"
              type="text"
              bind:value={notes}
              disabled={loading}
            />
          </div>

          <!-- Hidden fields for form submission -->
          <input type="hidden" name="pickup_location" value={pickupLocation} />
          <input
            type="hidden"
            name="delivery_location"
            value={deliveryLocation}
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
          <input type="hidden" name="distance_km" value={distanceKm ?? ""} />
          <input
            type="hidden"
            name="scheduled_date"
            value={scheduledDate ?? ""}
          />
          <input
            type="hidden"
            name="scheduled_time_slot"
            value={scheduledTimeSlot ?? ""}
          />
          <input
            type="hidden"
            name="scheduled_time"
            value={scheduledTime ?? ""}
          />
          <input
            type="hidden"
            name="urgency_fee_id"
            value={selectedUrgencyFeeId}
          />

          <!-- Type-based pricing hidden fields - only send in type mode -->
          {#if isTypePricingMode}
            <input type="hidden" name="service_type_id" value={serviceTypeId} />
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
            <input type="hidden" name="tolls" value={tolls} />
          {/if}

          <div class="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={loading ||
                !clientId ||
                !pickupLocation ||
                !deliveryLocation ||
                (scheduledTimeSlot === "specific" && !scheduledTime) ||
                (isTypePricingMode && !serviceTypeId)}
            >
              {loading ? m.saving() : m.action_save()}
            </Button>
            <Button
              type="button"
              variant="outline"
              href={localizeHref(`/courier/services/${data.service.id}`)}
              disabled={loading}
            >
              {m.action_cancel()}
            </Button>
          </div>
        </form>
      </Card.Content>
    </Card.Root>
  </div>
{/key}
