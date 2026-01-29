---
status: complete
priority: p3
issue_id: "181"
tags: [code-quality, constants, code-review]
dependencies: []
---

# Extract LOOKAHEAD_DAYS Constant

## Problem Statement

The number `14` for days to scan ahead is documented in design but hardcoded as a magic number in the code.

## Findings

- **Location:** `src/routes/courier/requests/+page.server.ts:103`
- Current code:
  ```typescript
  for (let i = 0; i < 14; i++) {
  ```
- Design doc line 140 documents "14 days"
- While documented, a named constant improves code clarity

## Proposed Solutions

### Option 1: Extract to named constant (Recommended)
```typescript
const LOOKAHEAD_DAYS = 14;

for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
```

- **Pros**: Self-documenting, easy to change
- **Cons**: One more line
- **Effort**: Small (5 minutes)
- **Risk**: Low

## Recommended Action

Extract magic number to named constant.

## Technical Details

- **Affected Files**: `src/routes/courier/requests/+page.server.ts`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] Constant `LOOKAHEAD_DAYS = 14` defined
- [ ] Loop uses constant instead of magic number
- [ ] Build passes

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready

## Notes

Source: PR #6 code review - code clarity improvement
