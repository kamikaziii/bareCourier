---
status: complete
priority: p2
issue_id: "112"
tags: [client, feature-parity, pricing, service-details]
dependencies: []
---

# Client Service Details Page Missing Type-Based Pricing Display

## Problem Statement
The client's service detail view doesn't show service type name, zone status, or price breakdown. The courier view has full pricing details, creating information asymmetry.

## Findings
- Location: `src/routes/client/services/[id]/+page.svelte`
- Client view shows: Status, locations, scheduling, notes, timestamps
- Client view missing: Service type, zone status, price breakdown
- Courier view (`/courier/services/[id]/+page.svelte:372-462`) shows full pricing details

## Problem Scenario
1. Client creates a service (type: Dental, in-zone)
2. Client views service details
3. Client cannot see:
   - What service type was assigned
   - Whether delivery is in-zone or out-of-zone
   - Price breakdown
4. Asymmetric information between courier and client

## Proposed Solutions

### Option 1: Add pricing card to client details (Recommended)
1. Update server load to fetch service type and visibility:
```typescript
const { data: service } = await supabase
    .from('services')
    .select('*, service_types(id, name, price)')
    .eq('id', params.id)
    .single();

const { data: courierProfile } = await supabase
    .from('profiles')
    .select('show_price_to_client')
    .eq('role', 'courier')
    .limit(1)
    .single();
```

2. Add pricing card to template:
```svelte
{#if data.showPriceToClient && (service.service_types || service.calculated_price)}
    <Card.Root>
        <!-- Service type, zone status, price -->
    </Card.Root>
{/if}
```
- **Pros**: Feature parity, transparency
- **Cons**: More code to maintain
- **Effort**: Medium
- **Risk**: Low

## Recommended Action
Option 1: Add simplified pricing info to client service details, respecting visibility setting.

## Technical Details
- **Affected Files**:
  - `src/routes/client/services/[id]/+page.svelte`
  - `src/routes/client/services/[id]/+page.server.ts`
- **Related Components**: Badge, Card, Separator
- **Database Changes**: No

## Resources
- Original finding: Pricing Audit 2025-01-29 (M1)
- Reference: Courier service details implementation

## Acceptance Criteria
- [ ] Client details shows service type name (if assigned)
- [ ] Client details shows zone status (in-zone/out-of-zone)
- [ ] Client details shows total price (if available)
- [ ] Respects `show_price_to_client` setting
- [ ] i18n keys added for new labels
- [ ] Tests pass

## Work Log

### 2025-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Medium priority for feature parity

## Notes
Source: Pricing Audit findings verification 2025-01-29
