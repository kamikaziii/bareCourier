---
status: ready
priority: p2
issue_id: "242"
tags: [code-review, pr-15, security]
dependencies: []
---

# Error Messages Expose Internal Details

## Problem Statement

The edge function returns raw Supabase error messages to the client, potentially exposing internal database structure, table names, or constraint details to attackers.

## Findings

**Location:** `supabase/functions/create-client/index.ts`

**Issue:** Raw Supabase errors are passed directly to the client response:

```typescript
if (error) {
  return new Response(JSON.stringify({ error: error.message }), { status: 500 });
}
```

This can expose:
- Database table names and column names
- Constraint violation details
- Internal error codes
- Stack traces in development mode

## Proposed Solution

Map internal errors to generic user-friendly messages:

```typescript
function mapErrorToUserMessage(error: PostgrestError): string {
  // Handle specific known error codes
  if (error.code === '23505') {
    return 'A client with this email already exists.';
  }
  if (error.code === '23503') {
    return 'Invalid reference data provided.';
  }
  if (error.code === '42501') {
    return 'You do not have permission to perform this action.';
  }
  
  // Generic fallback - never expose raw error
  console.error('Unhandled error:', error); // Log for debugging
  return 'An unexpected error occurred. Please try again.';
}
```

## Acceptance Criteria

- [ ] Create error mapping utility function
- [ ] Map common Postgres error codes to user-friendly messages
- [ ] Log original errors server-side for debugging
- [ ] Never expose raw database errors to clients
- [ ] Test with various error scenarios (duplicate email, invalid data, etc.)

## Work Log

| Date | Status | Notes |
|------|--------|-------|
| 2026-02-04 | Created | Code review finding from PR #15 |
