<script lang="ts">
	import { goto } from '$app/navigation';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as m from '$lib/paraglide/messages.js';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime.js';
	import type { Notification } from '$lib/database.types';
	import type { SupabaseClient } from '@supabase/supabase-js';
	import { Bell, CheckCheck, Package, Clock, CalendarClock } from '@lucide/svelte';

	let {
		supabase,
		userId,
		userRole = 'client'
	}: {
		supabase: SupabaseClient;
		userId: string;
		userRole?: 'courier' | 'client';
	} = $props();

	let notifications = $state<Notification[]>([]);
	let loading = $state(true);
	let open = $state(false);

	const unreadCount = $derived(notifications.filter((n) => !n.read).length);

	async function loadNotifications() {
		loading = true;
		const { data } = await supabase
			.from('notifications')
			.select('*')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(20);

		notifications = (data || []) as Notification[];
		loading = false;
	}

	async function markAsRead(id: string) {
		await supabase.from('notifications').update({ read: true }).eq('id', id);

		notifications = notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
	}

	async function markAllAsRead() {
		const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
		if (unreadIds.length === 0) return;

		await supabase.from('notifications').update({ read: true }).in('id', unreadIds);

		notifications = notifications.map((n) => ({ ...n, read: true }));
	}

	function formatRelativeTime(dateStr: string): string {
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);
		const diffDays = Math.floor(diffMs / 86400000);

		if (diffMins < 1) return m.time_just_now();
		if (diffMins < 60)
			return m.time_minutes_ago({ count: diffMins });
		if (diffHours < 24)
			return m.time_hours_ago({ count: diffHours });
		if (diffDays < 7)
			return m.time_days_ago({ count: diffDays });
		return date.toLocaleDateString(getLocale());
	}

	function getNotificationIcon(type: string) {
		switch (type) {
			case 'service_status':
				return CheckCheck;
			case 'new_request':
				return Package;
			case 'schedule_change':
				return CalendarClock;
			default:
				return Clock;
		}
	}

	async function handleNotificationClick(notification: Notification) {
		await markAsRead(notification.id);

		// Navigate to service if service_id is present
		if (notification.service_id) {
			const basePath = userRole === 'courier' ? '/courier/services' : '/client/services';
			open = false;
			await goto(localizeHref(`${basePath}/${notification.service_id}`));
		}
	}

	$effect(() => {
		loadNotifications();

		// Subscribe to real-time notifications
		const channel = supabase
			.channel('notifications')
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'notifications',
					filter: `user_id=eq.${userId}`
				},
				(payload) => {
					notifications = [payload.new as Notification, ...notifications];
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(channel);
		};
	});
</script>

<DropdownMenu.Root bind:open>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button variant="ghost" size="sm" class="relative" {...props}>
				<Bell class="size-5" />
				{#if unreadCount > 0}
					<span
						class="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
					>
						{unreadCount > 9 ? '9+' : unreadCount}
					</span>
				{/if}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-80">
		<div class="flex items-center justify-between px-3 py-2">
			<span class="font-semibold">{m.notifications()}</span>
			{#if unreadCount > 0}
				<Button variant="ghost" size="sm" class="h-auto p-0 text-xs" onclick={markAllAsRead}>
					{m.mark_all_read()}
				</Button>
			{/if}
		</div>
		<Separator />
		<div class="max-h-80 overflow-y-auto">
			{#if loading}
				<div class="px-3 py-4 text-center text-sm text-muted-foreground">
					{m.loading()}
				</div>
			{:else if notifications.length === 0}
				<div class="px-3 py-4 text-center text-sm text-muted-foreground">
					{m.no_notifications()}
				</div>
			{:else}
				{#each notifications as notification (notification.id)}
					{@const Icon = getNotificationIcon(notification.type)}
					<button
						class="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted {!notification.read
							? 'bg-muted/50'
							: ''}"
						onclick={() => handleNotificationClick(notification)}
					>
						<div
							class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full {!notification.read
								? 'bg-primary/10 text-primary'
								: 'bg-muted text-muted-foreground'}"
						>
							<Icon class="size-4" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="text-sm font-medium {!notification.read ? '' : 'text-muted-foreground'}">
								{notification.title}
							</p>
							<p class="text-xs text-muted-foreground line-clamp-2">
								{notification.message}
							</p>
							<p class="mt-1 text-xs text-muted-foreground">
								{formatRelativeTime(notification.created_at)}
							</p>
						</div>
						{#if !notification.read}
							<div class="mt-2 size-2 shrink-0 rounded-full bg-primary"></div>
						{/if}
					</button>
				{/each}
			{/if}
		</div>
	</DropdownMenu.Content>
</DropdownMenu.Root>
