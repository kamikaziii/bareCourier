---
status: ready
priority: p3
issue_id: "301"
tags: [code-review, code-quality, pr-19]
dependencies: []
---

# Extract magic number 3 for max suggestions

## Problem Statement

The max suggestions limit is hardcoded as `3` in `buildSuggestions`. This magic number includes the default address chip, so a client with a default sees only 2 history-based suggestions. The intent is unclear without a named constant.

## Findings

- `src/routes/client/new/+page.ts:30`: `if (suggestions.length >= 3) break;`
- The limit counts the default address as one of the 3
- Also, `limit(50)` on line 96 is a related magic number for the sample size
- Found by: kieran-typescript-reviewer agent

## Proposed Solutions

### Option 1: Named constants

**Approach:**
```typescript
const MAX_SUGGESTIONS = 3;
const ADDRESS_HISTORY_SAMPLE_SIZE = 50;
```

**Effort:** 5 minutes | **Risk:** Low

## Recommended Action

## Acceptance Criteria

- [ ] Magic numbers replaced with named constants
- [ ] Comment clarifying that MAX_SUGGESTIONS includes the default address

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)
