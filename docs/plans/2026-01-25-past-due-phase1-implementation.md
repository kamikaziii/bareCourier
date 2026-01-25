# Past Due System Phase 1 Implementation Plan

> **Status:** ✅ COMPLETE (2026-01-25)

**Goal:** Display urgency badges on service cards and sort by urgency priority.

**Architecture:** Computed urgency on render using existing `past-due.ts` utility. No database changes. UrgencyBadge shows for pending services that are approaching, urgent, past_due, or critical.

**Tech Stack:** Svelte 5, TypeScript, existing `sortByUrgency` and `calculateUrgency` functions.

---

## Task 1: Add Urgency Badge to Dashboard Service Cards

**Files:**
- Modify: `src/routes/courier/+page.svelte:259-267`

**Step 1: Add UrgencyBadge after status badge**

Find this block (around line 259-267):
```svelte
<div class="flex items-center gap-2">
	<span
		class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
		'pending'
			? 'bg-blue-500/10 text-blue-500'
			: 'bg-green-500/10 text-green-500'}"
	>
		{getStatusLabel(service.status)}
	</span>
```

Replace with:
```svelte
<div class="flex items-center gap-2">
	<UrgencyBadge service={service} size="sm" />
	<span
		class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium {service.status ===
		'pending'
			? 'bg-blue-500/10 text-blue-500'
			: 'bg-green-500/10 text-green-500'}"
	>
		{getStatusLabel(service.status)}
	</span>
```

**Step 2: Verify in browser**

Run: `pnpm run dev`
Expected: Dashboard shows urgency badges (if any services are approaching/past due)

**Step 3: Commit**

```bash
git add src/routes/courier/+page.svelte
git commit -m "feat: Add urgency badge to dashboard service cards"
```

---

## Task 2: Sort Dashboard Services by Urgency

**Files:**
- Modify: `src/routes/courier/+page.svelte:245`

**Step 1: Apply sortByUrgency to services loop**

Find this line (around line 245):
```svelte
{#each services as service (service.id)}
```

Replace with:
```svelte
{#each sortByUrgency(services) as service (service.id)}
```

**Step 2: Verify in browser**

Expected: Services are sorted with past due/urgent first, then on-track by scheduled time

**Step 3: Commit**

```bash
git add src/routes/courier/+page.svelte
git commit -m "feat: Sort dashboard services by urgency priority"
```

---

## Task 3: Add Urgency Badge to Services List

**Files:**
- Modify: `src/routes/courier/services/+page.svelte:449-461`

**Step 1: Add UrgencyBadge before date in services list**

Find this block (around line 449-461):
```svelte
<div class="flex items-center gap-2">
	<span class="text-xs text-muted-foreground">
		{formatDate(service.created_at)}
	</span>
	<Badge
		variant="outline"
		class={service.status === 'pending'
			? 'border-blue-500 text-blue-500'
			: 'border-green-500 text-green-500'}
	>
		{getStatusLabel(service.status)}
	</Badge>
</div>
```

Replace with:
```svelte
<div class="flex items-center gap-2">
	<UrgencyBadge service={service} size="sm" />
	<span class="text-xs text-muted-foreground">
		{formatDate(service.created_at)}
	</span>
	<Badge
		variant="outline"
		class={service.status === 'pending'
			? 'border-blue-500 text-blue-500'
			: 'border-green-500 text-green-500'}
	>
		{getStatusLabel(service.status)}
	</Badge>
</div>
```

**Step 2: Verify in browser**

Navigate to `/courier/services`
Expected: Services list shows urgency badges

**Step 3: Commit**

```bash
git add src/routes/courier/services/+page.svelte
git commit -m "feat: Add urgency badge to services list"
```

---

## Task 4: Sort Services List by Urgency (with filters)

**Files:**
- Modify: `src/routes/courier/services/+page.svelte:211-224` (filteredServices derived)

**Step 1: Apply sortByUrgency to filtered services**

Find the `filteredServices` derived (around line 211-224):
```typescript
const filteredServices = $derived(
	services.filter((s) => {
		if (statusFilter !== 'all' && s.status !== statusFilter) return false;
		if (clientFilter !== 'all' && s.client_id !== clientFilter) return false;
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const matchesClient = s.profiles?.name?.toLowerCase().includes(query);
			const matchesPickup = s.pickup_location?.toLowerCase().includes(query);
			const matchesDelivery = s.delivery_location?.toLowerCase().includes(query);
			if (!matchesClient && !matchesPickup && !matchesDelivery) return false;
		}
		return true;
	})
);
```

Replace with:
```typescript
const filteredServices = $derived(
	sortByUrgency(
		services.filter((s) => {
			if (statusFilter !== 'all' && s.status !== statusFilter) return false;
			if (clientFilter !== 'all' && s.client_id !== clientFilter) return false;
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const matchesClient = s.profiles?.name?.toLowerCase().includes(query);
				const matchesPickup = s.pickup_location?.toLowerCase().includes(query);
				const matchesDelivery = s.delivery_location?.toLowerCase().includes(query);
				if (!matchesClient && !matchesPickup && !matchesDelivery) return false;
			}
			return true;
		})
	)
);
```

**Step 2: Verify in browser**

Expected: Services list sorted by urgency, filters still work

**Step 3: Commit**

```bash
git add src/routes/courier/services/+page.svelte
git commit -m "feat: Sort services list by urgency priority"
```

---

## Task 5: Add Portuguese Translations for Urgency

**Files:**
- Modify: `messages/pt-PT.json`

**Step 1: Verify Portuguese translations exist**

Check that these keys exist in `messages/pt-PT.json`:
```json
"urgency_approaching": "A Vencer",
"urgency_urgent": "A Vencer",
"urgency_past_due": "Atrasado",
"urgency_critical": "Crítico"
```

If missing, add them.

**Step 2: Commit (if changes made)**

```bash
git add messages/pt-PT.json
git commit -m "fix: Add Portuguese translations for urgency levels"
```

---

## Task 6: Final Verification

**Step 1: Type check**

Run: `pnpm run check`
Expected: No new errors related to past-due or UrgencyBadge

**Step 2: Manual testing checklist**

- [ ] Dashboard shows urgency badges for approaching/past due services
- [ ] Dashboard sorts past due services first
- [ ] Services list shows urgency badges
- [ ] Services list sorts by urgency
- [ ] Filters still work on services list
- [ ] Language switch works (PT shows "Atrasado", EN shows "Past Due")
- [ ] Delivered services never show urgency badge

**Step 3: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: Phase 1 past due system polish"
```

---

## Summary

After completing these tasks:
- Courier dashboard shows urgency badges and sorts by urgency
- Services list shows urgency badges and sorts by urgency
- No database changes required
- Urgency is computed on render based on scheduled time vs current time

**Next Phase:** Phase 2 will add courier reschedule action and client notifications.
