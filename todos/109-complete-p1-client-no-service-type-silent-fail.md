---
status: complete
priority: p1
issue_id: "109"
tags: [data-integrity, silent-failure, type-pricing, client]
dependencies: []
---

# Client Request Fails Silently Without Default Service Type

## Problem Statement
When pricing mode is `type` but the client has no `default_service_type_id`, the service is created with `calculated_price = null`. No error is shown to the user, and no price is calculated. This leads to unbilled services.

## Findings
- Location: `src/routes/client/new/+page.server.ts:113-147`
- When `service_type_id` is null, the `if (service_type_id)` block is skipped
- Service is still inserted at line 174 with `calculated_price = null`
- No user feedback about missing service type assignment

## Problem Scenario
1. Courier switches to type-based pricing mode
2. Existing client doesn't have `default_service_type_id` assigned
3. Client creates a service request
4. `service_type_id = null`, so price calculation block is skipped
5. Service is inserted with `calculated_price = null`
6. Courier receives service with no price → billing confusion

## Proposed Solutions

### Option 1: Block the request (Recommended)
Return an error if client has no service type assigned:
```typescript
if (pricingMode === 'type') {
    service_type_id = await getClientDefaultServiceTypeId(supabase, user.id);
    if (!service_type_id) {
        return fail(400, {
            error: 'no_service_type_assigned',
            message: 'Please contact the courier to assign a service type.'
        });
    }
}
```
- **Pros**: Clear feedback, prevents unbilled services
- **Cons**: Blocks client until courier fixes
- **Effort**: Small
- **Risk**: Low

### Option 2: Fall back to first service type
```typescript
if (!service_type_id) {
    const types = await getServiceTypes(supabase);
    service_type_id = types.length > 0 ? types[0].id : null;
}
```
- **Pros**: Non-blocking
- **Cons**: May assign wrong type, silent assumption
- **Effort**: Small
- **Risk**: Medium

## Recommended Action
Option 1: Block with clear error message. Add i18n key for error.

## Technical Details
- **Affected Files**: `src/routes/client/new/+page.server.ts`
- **Related Components**: Client new service form
- **Database Changes**: No

## Resources
- Original finding: Pricing Audit 2025-01-29 (C1)
- Related issues: None

## Acceptance Criteria
- [ ] Client cannot create service without assigned service type in type-pricing mode
- [ ] Clear error message displayed to client
- [ ] i18n keys added for error message (EN + PT)
- [ ] Tests pass

## Work Log

### 2025-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Critical priority due to silent data integrity issue

## Notes
Source: Pricing Audit findings verification 2025-01-29
