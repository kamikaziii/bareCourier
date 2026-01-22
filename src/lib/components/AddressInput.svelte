<script lang="ts">
	import { Input } from '$lib/components/ui/input/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { searchAddress, type GeocodingResult } from '$lib/services/geocoding.js';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		value: string;
		onSelect: (address: string, coords: [number, number]) => void;
		placeholder?: string;
		disabled?: boolean;
		id?: string;
	}

	let { value = $bindable(''), onSelect, placeholder, disabled = false, id }: Props = $props();

	let suggestions = $state<GeocodingResult[]>([]);
	let searching = $state(false);
	let showSuggestions = $state(false);
	let debounceTimer: ReturnType<typeof setTimeout>;

	function handleInput(e: Event) {
		const target = e.target as HTMLInputElement;
		value = target.value;

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
		}, 200);
	}
</script>

<div class="relative">
	<Input
		{id}
		type="text"
		{value}
		{placeholder}
		{disabled}
		oninput={handleInput}
		onfocus={handleFocus}
		onblur={handleBlur}
		autocomplete="off"
	/>

	{#if searching}
		<div class="absolute right-3 top-1/2 -translate-y-1/2">
			<svg
				class="size-4 animate-spin text-muted-foreground"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		</div>
	{/if}

	{#if showSuggestions && suggestions.length > 0}
		<div
			class="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md"
		>
			{#each suggestions as result (result.id)}
				<Button
					variant="ghost"
					size="sm"
					class="w-full justify-start text-left font-normal h-auto py-2 whitespace-normal"
					onclick={() => handleSelect(result)}
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
						class="mr-2 flex-shrink-0"
					>
						<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
						<circle cx="12" cy="10" r="3" />
					</svg>
					<span class="truncate">{result.place_name}</span>
				</Button>
			{/each}
		</div>
	{/if}
</div>
