---
status: pending
priority: p2
issue_id: 338
tags: [code-review, security, pr-20]
dependencies: []
---

# Add Explicit client_id Filter in New Request Page (Two Locations)

## Problem Statement

Two queries for `client_addresses` in the new request page rely solely on RLS without explicit `client_id` filtering, unlike the address book page which explicitly filters. Inconsistent defense-in-depth.

## Findings

**Location 1 - Page loader** (`src/routes/client/new/+page.ts`, line 87-89):
```typescript
// Missing .eq('client_id', profile.id):
supabase.from('client_addresses').select('*').order('label')
```

**Location 2 - Client-side refresh** (`src/routes/client/new/+page.svelte`, line 52-57):
```typescript
// Also missing .eq('client_id', ...):
const { data: fresh } = await data.supabase
    .from("client_addresses").select("*").order("label");
```

Compare with address book page (`+page.server.ts`, line 17-21) which correctly uses `.eq('client_id', user.id)`.

**Flagged by:** Security Sentinel (INFO), Architecture Strategist. Location 2 missed by all agents -- found during verification.

## Proposed Solution

**Location 1** (`+page.ts`):
```typescript
supabase.from('client_addresses').select('*')
    .eq('client_id', profile.id)
    .order('label')
```

**Location 2** (`+page.svelte`):
```typescript
const { data: fresh } = await data.supabase
    .from("client_addresses").select("*")
    .eq("client_id", data.profile.id)
    .order("label");
```

- **Effort:** Trivial (2 one-line additions)
- **Risk:** None

## Acceptance Criteria

- [ ] `.eq('client_id', profile.id)` added to `+page.ts` savedAddresses query
- [ ] `.eq('client_id', ...)` added to `refreshSavedAddresses()` in `+page.svelte`

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
