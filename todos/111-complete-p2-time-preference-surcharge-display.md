---
status: complete
priority: p2
issue_id: "111"
tags: [ux, pricing, time-preference, display]
dependencies: []
---

# Time Preference Warning Shows Total Amount, Not Surcharge

## Problem Statement
The TimePreferencePicker component shows the TOTAL time preference price (€13) instead of the SURCHARGE amount (€9 = €13 - €4 base). The message says "surcharge" but displays the wrong value.

## Findings
- Location: `src/lib/components/TimePreferencePicker.svelte:246-249`
- First warning (on expansion) uses: `timePreferencePrice.toFixed(2)` directly
- Second warning (line 284-306) correctly uses: `priceDifference` (timePreferencePrice - basePrice)
- Design doc specifies: "⚠️ +€9.00 pela preferência de horário"

## Problem Scenario
1. Service type base price is €4 (e.g., Dental)
2. Time preference price is €13
3. User expands time preference section
4. Warning shows: "+€13.00 pela preferência de horário" (WRONG)
5. Expected: "+€9.00 pela preferência de horário" (€13 - €4 = €9)

## Proposed Solutions

### Option 1: Calculate surcharge for first warning (Recommended)
```svelte
{#if showPriceWarning && timePreferencePrice > 0}
    {@const surcharge = basePrice > 0 ? timePreferencePrice - basePrice : timePreferencePrice}
    {#if surcharge > 0}
        <p class="text-xs text-muted-foreground">
            {m.time_preference_surcharge({ amount: surcharge.toFixed(2) })}
        </p>
    {/if}
{/if}
```
- **Pros**: Accurate information, matches design spec
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Option 1: Fix the first warning to show actual surcharge amount.

## Technical Details
- **Affected Files**: `src/lib/components/TimePreferencePicker.svelte`
- **Related Components**: Used in courier/services/new, courier/services/edit, client/new
- **Database Changes**: No

## Resources
- Original finding: Pricing Audit 2025-01-29 (H2)
- Design spec: `docs/plans/2025-01-29-pricing-model-redesign.md`

## Acceptance Criteria
- [ ] First warning (line 246-249) shows surcharge, not total
- [ ] Surcharge = timePreferencePrice - basePrice
- [ ] When basePrice is 0, show full timePreferencePrice
- [ ] Both warnings are consistent
- [ ] Tests pass

## Work Log

### 2025-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- High priority due to confusing/misleading UX

## Notes
Source: Pricing Audit findings verification 2025-01-29
