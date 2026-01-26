<script lang="ts">
	import * as Tabs from '$lib/components/ui/tabs/index.js';
	import AccountTab from './AccountTab.svelte';
	import PricingTab from './PricingTab.svelte';
	import SchedulingTab from './SchedulingTab.svelte';
	import NotificationsTab from './NotificationsTab.svelte';
	import { Settings } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-6">
	<div class="flex items-center gap-2">
		<Settings class="size-6" />
		<h1 class="text-2xl font-bold">{m.settings_title()}</h1>
	</div>

	{#if form?.error}
		<div class="rounded-md bg-destructive/10 p-3 text-destructive">
			{#if form.error === 'urgency_in_use'}
				{m.settings_urgency_in_use()}
			{:else}
				{form.error}
			{/if}
		</div>
	{/if}

	{#if form?.success}
		<div class="rounded-md bg-green-500/10 p-3 text-green-600">
			{m.settings_saved()}
		</div>
	{/if}

	<Tabs.Root value="account" class="w-full">
		<Tabs.List class="grid w-full grid-cols-4">
			<Tabs.Trigger value="account">{m.settings_tab_account()}</Tabs.Trigger>
			<Tabs.Trigger value="pricing">{m.settings_tab_pricing()}</Tabs.Trigger>
			<Tabs.Trigger value="scheduling">{m.settings_tab_scheduling()}</Tabs.Trigger>
			<Tabs.Trigger value="notifications">{m.settings_tab_notifications()}</Tabs.Trigger>
		</Tabs.List>

		<Tabs.Content value="account" class="mt-6">
			<AccountTab profile={data.profile} session={data.session} />
		</Tabs.Content>

		<Tabs.Content value="pricing" class="mt-6">
			<PricingTab profile={data.profile} urgencyFees={data.urgencyFees} />
		</Tabs.Content>

		<Tabs.Content value="scheduling" class="mt-6">
			<SchedulingTab profile={data.profile} />
		</Tabs.Content>

		<Tabs.Content value="notifications" class="mt-6">
			<NotificationsTab profile={data.profile} supabase={data.supabase} />
		</Tabs.Content>
	</Tabs.Root>
</div>
