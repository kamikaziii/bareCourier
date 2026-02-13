---
status: ready
priority: p3
issue_id: "304"
tags: [code-review, svelte, state-management, pr-19]
dependencies: ["296"]
---

# Derive selectedChipIndex from value instead of explicit state

## Problem Statement

`selectedChipIndex` is tracked as explicit `$state`, requiring manual resets in `handleInput` and manual assignments in `handleChipSelect`. This is error-prone and unnecessary — the selected chip is fully determined by whether `value` matches a suggestion's address.

## Findings

- `src/lib/components/AddressInput.svelte:40`: `let selectedChipIndex = $state<number | null>(null)`
- Manual reset in `handleInput` (line 43): `selectedChipIndex = null`
- Manual set in `handleChipSelect` (line 105): `selectedChipIndex = index`
- Could be `$derived`: `const selectedChipIndex = $derived(addressSuggestions.findIndex(s => s.address === value))`
- This also means if a user manually types an address matching a chip, it highlights — arguably better UX
- Found by: code-simplicity-reviewer agent
- **Note:** Depends on #296 (naming fix) since the variable name `addressSuggestions` may change

## Proposed Solutions

### Option 1: Replace with $derived

**Approach:**
```typescript
const selectedChipIndex = $derived(suggestions.findIndex(s => s.address === value));
```
Remove manual assignments. Compare against `-1` instead of `null` in template.

**Effort:** 10 minutes | **Risk:** Low

## Recommended Action

## Acceptance Criteria

- [ ] `selectedChipIndex` is derived, not explicit state
- [ ] No manual resets/assignments for chip selection
- [ ] Chip highlights correctly when value matches

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)
