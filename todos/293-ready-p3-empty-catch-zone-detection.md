---
status: ready
priority: p3
issue_id: 293
tags: [code-review, pr-18, debugging, error-handling]
dependencies: []
---

# Empty catch block in zone-detection.ts should log warning

## Problem Statement

The `detectZone` function has an empty `catch {}` block that silently swallows reverse geocoding errors. While the fallback behavior is correct (falls through to string parsing), the silence makes debugging harder.

## Findings

- Pattern recognition agent flagged this
- The fallback design is correct -- just needs visibility

**Location:** `src/lib/services/zone-detection.ts:33`

## Proposed Solution

```typescript
} catch (err) {
    console.warn('Reverse geocode failed, falling back to string parsing:', err);
}
```

- **Effort:** Trivial (1 line)
- **Risk:** None

## Work Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-02-13 | Created from PR #18 code review | Pattern agent |
