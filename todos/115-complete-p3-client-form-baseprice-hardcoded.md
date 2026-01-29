---
status: complete
priority: p3
issue_id: "115"
tags: [client, ux, pricing, time-preference]
dependencies: ["111"]
---

# Client New Form Uses Hardcoded basePrice=0 for Surcharge Calculation

## Problem Statement
The client new service form passes `basePrice={0}` to TimePreferencePicker instead of using the client's actual service type price. This causes incorrect surcharge display.

## Findings
- Location: `src/routes/client/new/+page.svelte:273`
- Code: `basePrice={0}` hardcoded
- `data.clientServiceType` is available from load function (`+page.ts:26,51`)
- Should use: `basePrice={data.clientServiceType?.price ?? 0}`

## Problem Scenario
1. Client has default service type (Dental €4)
2. Time preference price is €13
3. Client expands time preference in new service form
4. Surcharge shows: €13 - €0 = €13 (WRONG)
5. Expected: €13 - €4 = €9

## Proposed Solutions

### Option 1: Use client's service type price (Recommended)
```svelte
<TimePreferencePicker
    ...
    showPriceWarning={true}
    basePrice={data.clientServiceType?.price ?? 0}
    timePreferencePrice={data.typePricingSettings.timeSpecificPrice}
/>
```
- **Pros**: Accurate surcharge display
- **Cons**: None
- **Effort**: Trivial
- **Risk**: Low

## Recommended Action
Option 1: Replace hardcoded 0 with client's service type price.

## Technical Details
- **Affected Files**: `src/routes/client/new/+page.svelte`
- **Related Components**: TimePreferencePicker
- **Database Changes**: No

## Resources
- Original finding: Pricing Audit 2025-01-29 (L2)
- Related: #111 (TimePreferencePicker surcharge fix)

## Acceptance Criteria
- [ ] basePrice uses `data.clientServiceType?.price ?? 0`
- [ ] Surcharge displays correctly for clients with assigned service types
- [ ] Falls back to 0 if no service type assigned
- [ ] Tests pass

## Work Log

### 2025-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Low priority, trivial fix
- Depends on #111 for full effect

## Notes
Source: Pricing Audit findings verification 2025-01-29
