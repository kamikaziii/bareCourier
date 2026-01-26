---
status: ready
priority: p2
issue_id: "051"
tags: [code-review, security, input-validation]
dependencies: []
---

# JSON.parse Without Error Handling

## Problem Statement

Several locations use `JSON.parse()` without try-catch blocks, which could cause unhandled exceptions if malformed JSON is submitted.

## Findings

**Affected Files:**

1. `src/routes/courier/clients/[id]/+page.server.ts` (line 138):
```typescript
const zones = JSON.parse(zonesJson) as { min_km: number; max_km: number | null; price: number }[];
```

2. `src/routes/courier/clients/[id]/edit/+page.server.ts` (line 113):
```typescript
const zones = JSON.parse(zonesJson) as { min_km: number; max_km: number | null; price: number }[];
```

3. `src/routes/courier/billing/[client_id]/+page.server.ts` (line 107):
```typescript
const zones = JSON.parse(zonesJson) as { min_km: number; max_km: number | null; price: number }[];
```

**Good example** in `src/routes/courier/+page.server.ts` (lines 57-65):
```typescript
try {
    serviceIds = JSON.parse(serviceIdsRaw) as string[];
} catch {
    return { success: false, error: 'Invalid service selection' };
}
```

## Proposed Solutions

### Option A: Wrap each JSON.parse in try-catch
**Pros:** Minimal change, handles errors gracefully
**Cons:** Repetitive
**Effort:** Small
**Risk:** Very Low

### Option B: Create safeJsonParse helper (Recommended)
**Pros:** DRY, consistent error handling
**Cons:** Small additional abstraction
**Effort:** Small
**Risk:** Very Low

```typescript
function safeJsonParse<T>(json: string, fallback: T): T {
    try {
        return JSON.parse(json) as T;
    } catch {
        return fallback;
    }
}
```

## Recommended Action

Wrap each JSON.parse in try-catch blocks with appropriate error responses.

## Technical Details

**Affected Files:**
- `src/routes/courier/clients/[id]/+page.server.ts`
- `src/routes/courier/clients/[id]/edit/+page.server.ts`
- `src/routes/courier/billing/[client_id]/+page.server.ts`

## Acceptance Criteria

- [ ] All JSON.parse calls wrapped in try-catch
- [ ] Meaningful error messages returned on parse failure
- [ ] No unhandled exceptions from malformed JSON

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-26 | Issue identified during security review | External input should always be validated |

## Resources

- OWASP A03: Injection
