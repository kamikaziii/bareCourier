---
status: pending
priority: p1
issue_id: 334
tags: [code-review, security, pr-20]
dependencies: []
---

# PostgREST Filter Injection in Address Book Search

## Problem Statement

The address book server load function interpolates raw user input into a PostgREST `.or()` filter string without sanitization. PostgREST uses `.`, `,`, and `()` as syntax delimiters, so a search term containing these characters can inject additional filter conditions or break the query.

**Why it matters:** While RLS limits the blast radius (attacker can only manipulate which of their *own* addresses are returned), malicious filter strings could cause PostgREST parsing errors that leak column names, and this pattern sets a dangerous precedent if copied to less-protected queries.

## Findings

**File:** `src/routes/client/address-book/+page.server.ts`, line ~23

```typescript
if (search) {
    query = query.or(`label.ilike.%${search}%,address.ilike.%${search}%`);
}
```

The Supabase postgrest-js `.or()` method passes the filter string completely as-is to PostgREST with zero sanitization. The library source even warns: *"used as-is and need to follow PostgREST syntax. You also need to make sure they are properly sanitized."*

**Flagged by:** Security Sentinel, Performance Oracle, Pattern Recognition (3/6 agents)

## Proposed Solutions

### Option A: Double-quote values per PostgREST spec (Recommended)
```typescript
if (search) {
    const escaped = search.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    query = query.or(`label.ilike."%${escaped}%",address.ilike."%${escaped}%"`);
}
```
- **Pros:** Handles all edge cases per PostgREST spec; allows searches containing `.` and `,`
- **Cons:** Slightly more complex escaping
- **Effort:** Small (1-2 lines)
- **Risk:** Low

### Option B: Strip special characters
```typescript
const sanitized = search.replace(/[.,()\\%_]/g, '');
if (sanitized) {
    query = query.or(`label.ilike.%${sanitized}%,address.ilike.%${sanitized}%`);
}
```
- **Pros:** Simple
- **Cons:** Users can't search for addresses containing periods (e.g., "Rua Dr. Silva")
- **Effort:** Small
- **Risk:** Low

## Recommended Action

Option A -- double-quote escaping per PostgREST spec.

## Technical Details

- **Affected files:** `src/routes/client/address-book/+page.server.ts`
- **Supabase postgrest-js version:** 2.91.0

## Acceptance Criteria

- [ ] Search input is sanitized/escaped before PostgREST filter interpolation
- [ ] Searching for "Rua Dr. Silva" returns correct results (period in search)
- [ ] Searching for "foo,bar" does not inject additional filter conditions

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-13 | Created from PR #20 code review | 3 of 6 agents flagged this independently |

## Resources

- [PR #20](https://github.com/kamikaziii/bareCourier/pull/20)
- [Supabase Discussion #3843](https://github.com/orgs/supabase/discussions/3843) -- SQL injection thoughts on `.or()`
- [postgrest-js Issue #164](https://github.com/supabase/postgrest-js/issues/164)
