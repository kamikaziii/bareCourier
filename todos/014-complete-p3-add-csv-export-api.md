# Add Server-Side CSV Export Endpoint

---
status: complete
priority: p3
issue_id: "014"
tags: [code-review, agent-native, api]
dependencies: []
---

## Problem Statement

CSV export is implemented entirely client-side using JavaScript. There's no API endpoint that an agent could call to programmatically generate reports.

**Why it matters**: Limits API-based integrations and automation capabilities.

## Findings

- **Location**: `src/routes/courier/reports/+page.svelte` (lines 94-125)
- **Agent**: agent-native-reviewer

**Current Implementation**: Client-side blob generation and download

## Proposed Solutions

### Option 1: Create API Route (Recommended)
Create `src/routes/api/reports/csv/+server.ts`:

```typescript
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { supabase, safeGetSession } }) => {
    const { session, user } = await safeGetSession();
    if (!session) {
        return new Response('Unauthorized', { status: 401 });
    }

    // Verify courier role
    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (profile?.role !== 'courier') {
        return new Response('Forbidden', { status: 403 });
    }

    const startDate = url.searchParams.get('start');
    const endDate = url.searchParams.get('end');
    const clientId = url.searchParams.get('client_id');

    // Fetch and format data as CSV
    // ...

    return new Response(csvContent, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="report-${startDate}-${endDate}.csv"`
        }
    });
};
```

**Effort**: Medium
**Risk**: Low

### Option 2: Edge Function
Create Supabase Edge Function for CSV generation.

**Pros**: Can be called without SvelteKit
**Cons**: More infrastructure
**Effort**: Medium
**Risk**: Low

## Acceptance Criteria

- [x] API endpoint created
- [x] Returns CSV with proper headers
- [x] Supports date range and client filters
- [x] Only accessible by courier role

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified by agent-native-reviewer | Client-only features limit automation |
| 2026-01-22 | Approved during triage | Ready for implementation - create SvelteKit API route |
| 2026-01-24 | Implemented API endpoint | Created `src/routes/api/reports/csv/+server.ts` with full auth, filtering, and CSV generation |

## Resources

- SvelteKit Server Routes: https://kit.svelte.dev/docs/routing#server
- CSV Generation: https://www.npmjs.com/package/papaparse
- Content Disposition: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Disposition
