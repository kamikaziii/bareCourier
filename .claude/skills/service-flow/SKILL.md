---
name: service-flow
description: Tests the complete service request lifecycle using Playwright. Use when testing service status flows, verifying request handling between courier and client, or validating the notification system.
disable-model-invocation: true
---

<objective>
Test the complete service request lifecycle in bareCourier, covering all status transitions from creation to delivery. This skill provides test scenarios and assertions for validating the courier-client interaction flow.
</objective>

<quick_start>
Run the happy path test:

1. Use `playwright-test-generator` agent
2. Select "Happy Path: Accept Flow" scenario
3. Base URL: `http://localhost:5173`
4. Output: `tests/service-flow/accept-flow.spec.ts`
</quick_start>

<status_flow>
```
Client creates request (pending)
         │
         ▼
Courier reviews request
         │
    ┌────┴────┬─────────────┐
    ▼         ▼             ▼
 accepted   rejected    suggested
    │                       │
    │                  ┌────┴────┐
    │                  ▼         ▼
    │            client       client
    │            accepts      declines
    │                │
    ▼                ▼
  scheduled      scheduled
         │
         ▼
      delivered
```
</status_flow>

<test_scenarios>
**1. Happy Path: Accept Flow**
1. Client logs in at `/login`
2. Client creates service at `/client/new`
3. Verify service appears in client dashboard
4. Courier logs in
5. Courier sees service in `/courier` dashboard
6. Courier accepts the request
7. Verify status changes to `accepted`
8. Verify client receives notification

**2. Rejection Flow**
1. Client creates service
2. Courier rejects with reason
3. Verify status is `rejected`
4. Verify client sees rejection reason

**3. Suggestion Flow**
1. Client creates service with requested date/time
2. Courier suggests alternative date
3. Verify status is `suggested`
4. Client accepts suggestion
5. Verify status becomes `scheduled`

**4. Delivery Flow**
1. Service is in `accepted`/`scheduled` status
2. Courier marks as delivered
3. Verify `delivered_at` timestamp is set
4. Verify status badge shows green
</test_scenarios>

<assertions>
- Status colors: pending=blue, delivered=green
- Notifications appear in NotificationBell component
- RLS: Client A cannot see Client B's services
- Soft delete: Deleted services have `deleted_at` set
</assertions>

<test_data>
- Courier account: use existing courier in dev database
- Client accounts: create test clients or use existing
</test_data>

<related_files>
- `src/routes/client/new/+page.svelte` - Create service form
- `src/routes/courier/+page.svelte` - Courier dashboard
- `src/routes/courier/services/+page.svelte` - Services list
- `src/lib/components/NotificationBell.svelte` - Notifications
</related_files>

<success_criteria>
Testing is complete when:
- [ ] All four scenarios have passing tests
- [ ] Status transitions are verified
- [ ] Notifications are confirmed
- [ ] RLS isolation is validated
</success_criteria>
