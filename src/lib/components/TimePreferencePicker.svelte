<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Popover from "$lib/components/ui/popover/index.js";
  import { Calendar } from "$lib/components/ui/calendar/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { formatCurrency } from "$lib/utils.js";
  import type { TimeSlot } from "$lib/database.types.js";
  import {
    DateFormatter,
    getLocalTimeZone,
    parseDate,
    today,
    type DateValue,
  } from "@internationalized/date";

  interface Props {
    selectedDate: string | null;
    selectedTimeSlot: TimeSlot | null;
    selectedTime: string | null;
    onDateChange: (date: string | null) => void;
    onTimeSlotChange: (slot: TimeSlot | null) => void;
    onTimeChange: (time: string | null) => void;
    disabled?: boolean;
    showPriceWarning?: boolean;
    basePrice?: number;
    timePreferencePrice?: number;
    /** When true, out-of-zone pricing takes precedence and time preference has no price effect */
    isOutOfZone?: boolean;
    /** When true, zone check is in progress — suppress surcharge info to avoid flicker */
    zoneCheckInProgress?: boolean;
  }

  let {
    selectedDate,
    selectedTimeSlot,
    selectedTime,
    onDateChange,
    onTimeSlotChange,
    onTimeChange,
    disabled = false,
    showPriceWarning = false,
    basePrice = 0,
    timePreferencePrice = 0,
    isOutOfZone = false,
    zoneCheckInProgress = false,
  }: Props = $props();

  // Use a function to get the DateFormatter with current locale
  const getDateFormatter = () =>
    new DateFormatter(getLocale(), {
      dateStyle: "long",
    });

  // Use a derived value for calendar that syncs with selectedDate prop
  // svelte-ignore state_referenced_locally - intentional: initial value from prop, synced via $effect below
  let calendarValue = $state<DateValue | undefined>(
    selectedDate ? parseDate(selectedDate) : undefined,
  );

  // Sync calendarValue when selectedDate changes externally
  $effect(() => {
    if (selectedDate) {
      calendarValue = parseDate(selectedDate);
    } else {
      calendarValue = undefined;
    }
  });

  let popoverOpen = $state(false);
  let timePreferenceExpanded = $state(false);

  // Auto-expand if time slot is already selected
  $effect(() => {
    if (selectedTimeSlot) {
      timePreferenceExpanded = true;
    }
  });

  const timeSlots: { value: TimeSlot; label: () => string }[] = [
    { value: "morning", label: () => m.time_slot_morning() },
    { value: "afternoon", label: () => m.time_slot_afternoon() },
    { value: "evening", label: () => m.time_slot_evening() },
    { value: "specific", label: () => m.time_slot_specific() },
  ];

  function handleDateSelect(date: DateValue | undefined) {
    calendarValue = date;
    if (date) {
      onDateChange(date.toString());
    } else {
      onDateChange(null);
    }
    popoverOpen = false;
  }

  function handleTimeSlotClick(slot: TimeSlot) {
    if (selectedTimeSlot === slot) {
      onTimeSlotChange(null);
      if (slot === "specific") {
        onTimeChange(null);
      }
    } else {
      onTimeSlotChange(slot);
      if (slot !== "specific") {
        onTimeChange(null);
      }
    }
  }

  function clearDate() {
    calendarValue = undefined;
    onDateChange(null);
  }

  function expandTimePreference() {
    timePreferenceExpanded = true;
  }

  function collapseTimePreference() {
    timePreferenceExpanded = false;
    onTimeSlotChange(null);
    onTimeChange(null);
  }

  const displayDate = $derived(
    calendarValue
      ? getDateFormatter().format(calendarValue.toDate(getLocalTimeZone()))
      : m.schedule_select_date(),
  );

  // Show price warning if time preference is selected and adds cost
  // Don't show when out-of-zone (out-of-zone pricing takes precedence, time preference has no effect)
  const showWarning = $derived(
    showPriceWarning &&
      selectedTimeSlot &&
      timePreferencePrice > basePrice &&
      !isOutOfZone,
  );

  const priceDifference = $derived(timePreferencePrice - basePrice);

  // Whether to show surcharge info (hide when out-of-zone or zone check in progress)
  const showSurchargeInfo = $derived(
    showPriceWarning &&
      timePreferencePrice > 0 &&
      !isOutOfZone &&
      !zoneCheckInProgress,
  );
</script>

<div class="space-y-4">
  <!-- Date picker (required) -->
  <div class="space-y-2">
    <Label>{m.schedule_date()}</Label>
    <Popover.Root bind:open={popoverOpen}>
      <Popover.Trigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="outline"
            class="w-full justify-start text-left font-normal {!calendarValue
              ? 'text-muted-foreground'
              : ''}"
            {disabled}
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
              class="mr-2"
            >
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
              <line x1="16" x2="16" y1="2" y2="6" />
              <line x1="8" x2="8" y1="2" y2="6" />
              <line x1="3" x2="21" y1="10" y2="10" />
            </svg>
            {displayDate}
          </Button>
        {/snippet}
      </Popover.Trigger>
      <Popover.Content class="w-auto p-0" align="start">
        <Calendar
          type="single"
          bind:value={calendarValue}
          onValueChange={handleDateSelect}
          minValue={today(getLocalTimeZone())}
          locale={getLocale()}
        />
        {#if calendarValue}
          <div class="border-t p-2">
            <Button
              variant="ghost"
              size="sm"
              class="w-full"
              onclick={clearDate}
            >
              {m.schedule_clear_date()}
            </Button>
          </div>
        {/if}
      </Popover.Content>
    </Popover.Root>
  </div>

  <!-- Time preference section -->
  {#if !timePreferenceExpanded}
    <!-- Collapsed: show "Add time preference" button -->
    <div class="space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        class="w-full text-muted-foreground"
        onclick={expandTimePreference}
        {disabled}
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
          class="mr-2"
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {m.time_preference_add()}
      </Button>

      <!-- Warning shown in collapsed state (hidden when out-of-zone) -->
      {#if showSurchargeInfo}
        <p class="text-xs text-muted-foreground pl-1">
          ⚠️ {m.time_preference_warning()}
        </p>
      {/if}
    </div>
  {:else}
    <!-- Expanded: show time slot selection -->
    <div class="space-y-3 rounded-md border p-3">
      <div class="flex items-center justify-between">
        <Label>{m.schedule_time_slot()}</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          class="h-6 px-2 text-muted-foreground"
          onclick={collapseTimePreference}
          {disabled}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </Button>
      </div>

      <!-- Info text shown immediately on expansion (hidden when out-of-zone) -->
      {#if showSurchargeInfo}
        {@const surcharge =
          basePrice > 0 ? timePreferencePrice - basePrice : timePreferencePrice}
        {#if surcharge > 0}
          <p class="text-xs text-muted-foreground">
            {m.time_preference_surcharge({ amount: formatCurrency(surcharge) })}
          </p>
        {/if}
      {/if}

      <div class="grid grid-cols-2 gap-2">
        {#each timeSlots as slot (slot.value)}
          <Button
            type="button"
            variant={selectedTimeSlot === slot.value ? "default" : "outline"}
            size="sm"
            class="w-full"
            onclick={() => handleTimeSlotClick(slot.value)}
            {disabled}
          >
            {slot.label()}
          </Button>
        {/each}
      </div>

      <!-- Specific time input -->
      {#if selectedTimeSlot === "specific"}
        <div class="space-y-2">
          <Label for="specific-time">{m.schedule_time()}</Label>
          <Input
            id="specific-time"
            type="time"
            required
            lang={getLocale()}
            value={selectedTime || ""}
            oninput={(e) => onTimeChange(e.currentTarget.value || null)}
            {disabled}
          />
        </div>
      {/if}

      <!-- Price warning -->
      {#if showWarning}
        <div
          class="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-sm text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
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
            <path
              d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
            />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            {m.time_preference_price_warning({
              amount: formatCurrency(priceDifference),
            })}
          </span>
        </div>
      {/if}
    </div>
  {/if}
</div>
