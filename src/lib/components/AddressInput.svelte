<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import {
    searchAddress,
    type GeocodingResult,
  } from "$lib/services/geocoding.js";
  import * as m from "$lib/paraglide/messages.js";
  import { MapPin, Check, AlertTriangle } from "@lucide/svelte";

  type AddressState = "idle" | "typing" | "verified" | "custom";

  interface Props {
    value: string;
    onSelect: (address: string, coords: [number, number] | null) => void;
    placeholder?: string;
    disabled?: boolean;
    id?: string;
    showHint?: boolean;
  }

  let {
    value = $bindable(""),
    onSelect,
    placeholder,
    disabled = false,
    id,
    showHint = true,
  }: Props = $props();

  let suggestions = $state<GeocodingResult[]>([]);
  let searching = $state(false);
  let showSuggestions = $state(false);
  let addressState = $state<AddressState>("idle");
  let showVerifiedAnimation = $state(false);
  let debounceTimer: ReturnType<typeof setTimeout>;

  function handleInput() {
    addressState = value.length > 0 ? "typing" : "idle";

    // Debounce search
    clearTimeout(debounceTimer);
    if (value.length >= 3) {
      searching = true;
      debounceTimer = setTimeout(async () => {
        suggestions = await searchAddress(value);
        searching = false;
        showSuggestions = suggestions.length > 0;
      }, 300);
    } else {
      suggestions = [];
      showSuggestions = false;
      searching = false;
    }
  }

  function handleSelect(result: GeocodingResult) {
    value = result.place_name;
    onSelect(result.place_name, result.center);
    showSuggestions = false;
    suggestions = [];
    addressState = "verified";

    // Trigger green highlight animation
    showVerifiedAnimation = true;
    setTimeout(() => {
      showVerifiedAnimation = false;
    }, 600);
  }

  function handleFocus() {
    if (suggestions.length > 0) {
      showSuggestions = true;
    }
  }

  function handleBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      showSuggestions = false;
      // If user typed something but didn't select from suggestions
      if (value.length > 0 && addressState === "typing") {
        addressState = "custom";
        onSelect(value, null);
      }
    }, 200);
  }

  function handleKeydown(e: KeyboardEvent) {
    // If user presses Enter without selecting a suggestion, mark as custom
    if (e.key === "Enter" && addressState === "typing") {
      addressState = "custom";
      onSelect(value, null);
      showSuggestions = false;
    }
  }

  const hintText = $derived(() => {
    switch (addressState) {
      case "verified":
        return m.address_hint_verified();
      case "custom":
        return m.address_hint_custom();
      default:
        return m.address_hint_idle();
    }
  });
</script>

<div class="space-y-1">
  <div class="relative">
    <Input
      {id}
      type="text"
      bind:value
      {placeholder}
      {disabled}
      oninput={handleInput}
      onfocus={handleFocus}
      onblur={handleBlur}
      onkeydown={handleKeydown}
      autocomplete="off"
      class={showVerifiedAnimation
        ? "ring-2 ring-green-500 transition-all duration-300"
        : ""}
    />

    {#if searching}
      <div class="absolute right-3 top-1/2 -translate-y-1/2">
        <svg
          class="size-4 animate-spin text-muted-foreground"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          ></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      </div>
    {/if}

    {#if showSuggestions && suggestions.length > 0}
      <!-- Prevent mousedown from blurring the input, so slow clicks still reach handleSelect -->
      <div
        class="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md"
        onmousedown={(e) => e.preventDefault()}
      >
        {#each suggestions as result (result.id)}
          <Button
            variant="ghost"
            size="sm"
            class="h-auto w-full justify-start whitespace-normal py-2 text-left font-normal"
            onclick={() => handleSelect(result)}
          >
            <MapPin class="mr-2 size-4 flex-shrink-0" />
            <span class="truncate">{result.place_name}</span>
          </Button>
        {/each}
      </div>
    {/if}
  </div>

  {#if showHint}
    <p
      class="flex items-center gap-1 text-xs {addressState === 'verified'
        ? 'text-green-600'
        : addressState === 'custom'
          ? 'text-amber-600'
          : 'text-muted-foreground'}"
      aria-live="polite"
    >
      {#if addressState === "verified"}
        <Check class="size-3" />
      {:else if addressState === "custom"}
        <AlertTriangle class="size-3" />
      {/if}
      {hintText()}
    </p>
  {/if}
</div>
