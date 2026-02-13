---
status: complete
priority: p3
issue_id: "303"
tags: [code-review, css, conventions, pr-19]
dependencies: []
---

# Replace JS truncateLabel with CSS truncation

## Problem Statement

The `truncateLabel` function truncates address strings to 30 characters in JS. The rest of the codebase universally uses Tailwind's `truncate` class for text truncation. JS truncation has disadvantages: fixed character cutoff ignores viewport/font size, and two addresses sharing the first 30 characters become indistinguishable.

## Findings

- `src/routes/client/new/+page.ts:4-6`: `truncateLabel` function
- Codebase convention: CSS `truncate` class (used in MobileBottomNav, SidebarItem, geocoding results in AddressInput itself)
- The `label` field on `AddressSuggestion` type exists solely because of this JS truncation
- Removing it simplifies the type from 4 to 3 fields
- Found by: pattern-recognition-specialist, code-simplicity-reviewer agents

## Proposed Solutions

### Option 1: CSS truncation on chip, remove label field

**Approach:** Drop `truncateLabel` function and `label` field from type. Use `max-w-[14rem] truncate` on the chip button, render `suggestion.address` directly.

**Effort:** 15 minutes | **Risk:** Low

## Recommended Action

## Acceptance Criteria

- [ ] `truncateLabel` function removed
- [ ] `label` field removed from `AddressSuggestion` type
- [ ] Chips use CSS truncation
- [ ] Long addresses display with ellipsis

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)
