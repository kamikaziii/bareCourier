---
status: pending
priority: p2
issue_id: "236"
tags: [code-review, architecture, documentation, pr-16]
dependencies: []
---

# Inconsistent Toast Patterns Need Documentation

## Problem Statement

The PR introduces 3 distinct toast usage patterns without guidance on when to use each. Future developers won't know which pattern to follow.

**Why it matters:** Inconsistency leads to maintenance burden and code review friction.

## Findings

**Source:** Architecture Strategist + Pattern Recognition Agents

**Three patterns found:**

1. **Direct toast in `use:enhance`** (Most common)
   - ServiceTypesSection.svelte, PricingTab.svelte, etc.
   - Manual `toast.success()` / `toast.error()` calls

2. **withToast() wrapper** (Defined but unused)
   - `src/lib/utils/toast.ts:20-53`
   - Never actually called anywhere

3. **Inline + toast mixed** (Confusing)
   - Validation errors stay inline, operation errors in toast
   - client/new, services/new

**Problem:** No documentation explains when to use each approach.

## Proposed Solutions

### Option A: Document Decision Tree (Recommended)

Create `.claude/rules/toast-patterns.md`:

```markdown
## When to Use Each Pattern

| Scenario | Pattern | Example |
|----------|---------|---------|
| Form submission success/error | Direct toast in enhance | AccountTab.svelte |
| Field validation errors | Inline banner | Keep context near field |
| Async Supabase operations | withToast() OR direct | Choose one, be consistent |
| Batch operations | Summary toast | "5 items updated" |
```

**Pros:** Clear guidance, reduces code review friction
**Cons:** Documentation maintenance
**Effort:** Small
**Risk:** Low

### Option B: Standardize on One Pattern
Pick one approach, refactor all to match.

**Pros:** Maximum consistency
**Cons:** Large refactor scope
**Effort:** Large
**Risk:** Medium

## Recommended Action

<!-- Fill after triage -->

## Technical Details

**Deliverable:** `.claude/rules/toast-patterns.md`

## Acceptance Criteria

- [ ] Toast pattern documentation created
- [ ] Decision tree for pattern selection
- [ ] Examples of correct usage
- [ ] Added to code review checklist

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from PR #16 code review | Architecture agent flagged pattern confusion |

## Resources

- PR #16: feat: implement toast notification system
