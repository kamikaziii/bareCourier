---
status: ready
priority: p3
issue_id: "174"
tags: [code-review, git, security, pr-5]
dependencies: []
---

# Consider Squashing Migration Security Fix Commit

## Problem Statement

The migration file was modified in two separate commits: first creating tables with basic RLS, then strengthening RLS in a follow-up "fix" commit. This leaves a potentially insecure intermediate state in the git history.

## Findings

**Commit 1:** `217e704` - `feat(db): add workload management tables`
- Created initial RLS policies without `is_courier()` check

**Commit 2:** `bc5f838` - `fix(db): strengthen RLS policies and add missing index`
- Added `is_courier()` check to prevent privilege escalation
- Fixed security vulnerability

**Issue:** If someone were to checkout an intermediate commit or if migrations are applied incrementally, there's a window where the insecure policy exists.

## Proposed Solutions

### Option A: Squash Commits Before Merge (Recommended)

```bash
git rebase -i origin/main
# Mark bc5f838 as "fixup" under 217e704
```

**Pros:** Clean history, no insecure intermediate state
**Cons:** Rewrites history (OK before merge)
**Effort:** Small
**Risk:** Low

### Option B: Keep Separate for Audit Trail

Leave commits as-is with a note in PR description explaining the security improvement.

**Pros:** Shows thought process, documents the fix
**Cons:** Insecure intermediate state visible
**Effort:** None
**Risk:** Low (migrations applied together)

### Option C: Document in Migration Comment

Add a comment in the migration file explaining the security model.

**Pros:** Self-documenting
**Cons:** Doesn't change git history
**Effort:** Trivial
**Risk:** Low

## Recommended Action

*To be filled during triage*

## Technical Details

**Affected commits:**
- `217e704` feat(db): add workload management tables
- `bc5f838` fix(db): strengthen RLS policies and add missing index

## Acceptance Criteria

- [ ] Decision made on commit strategy
- [ ] If squashing: commits combined before merge
- [ ] If keeping: PR description documents the security evolution

## Work Log

### 2026-01-29 - Initial Finding

**By:** Code Review Agent (git-history-analyzer)

**Actions:**
- Analyzed commit history for PR #5
- Identified security fix as follow-up commit

**Learnings:**
- Security-related changes should be correct in initial commit when possible

## Resources

- PR #5: https://github.com/kamikaziii/bareCourier/pull/5
