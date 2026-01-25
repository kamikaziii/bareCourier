# Visibility Settings Not Used in Client Form

---
status: complete
priority: p2
issue_id: "045"
tags: [feature-incomplete, ux, pr-4]
dependencies: []
---

**Priority**: P2 (Important)
**File**: `src/routes/client/new/+page.svelte`
**Source**: PR #4 Code Review

## Issue

The PR description states clients should see estimated cost based on `showPriceToClient` setting, but the client form doesn't actually implement this feature. The setting exists but isn't used to conditionally display price.

## PR Description Claim

> "Clients see estimated cost when creating requests" (controlled by `show_price_to_client`)

## Current Implementation

The client form:
1. Loads `courierSettings` including `showPriceToClient`
2. Never checks `showPriceToClient` to conditionally render price
3. No price preview section exists in the form

## Expected Implementation

```svelte
{#if courierSettings?.showPriceToClient && calculatedPrice !== null}
  <div class="rounded-md bg-muted p-3">
    <div class="flex justify-between">
      <span class="text-muted-foreground">{m.billing_estimated_cost()}</span>
      <span class="font-medium">€{calculatedPrice.toFixed(2)}</span>
    </div>
  </div>
{/if}
```

## Fix Options

1. **Add client-side price preview** - Calculate and show price before submission
2. **Remove the claim** - If price preview isn't intended for clients, update the setting description
3. **Show price after submission** - Display calculated price in success message

## Acceptance Criteria

- [ ] Client form respects `showPriceToClient` setting
- [ ] Price preview shown when setting is enabled
- [ ] Or: Setting description updated if not intended

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified in PR #4 review | Features should match their descriptions |
| 2026-01-24 | Approved during triage | Status: ready |
