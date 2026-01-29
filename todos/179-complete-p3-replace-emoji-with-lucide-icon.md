---
status: complete
priority: p3
issue_id: "179"
tags: [ui, accessibility, code-review, icons]
dependencies: []
---

# Replace Emoji with Lucide Lightbulb Icon

## Problem Statement

The 💡 emoji is used for the "next compatible day" suggestion, but this conflicts with project CLAUDE.md guidelines ("avoid emojis unless requested") and has accessibility concerns.

## Findings

- **Location:** `src/routes/courier/requests/+page.svelte:575, 682`
- Current code:
  ```svelte
  <span class="text-blue-600">💡</span>
  ```
- Design doc explicitly included emoji, but conflicts with project guidelines
- Emojis can have inconsistent rendering and screen reader issues
- Rest of app uses Lucide icons consistently

## Proposed Solutions

### Option 1: Use Lucide Lightbulb (Recommended)
```svelte
import { Lightbulb } from '@lucide/svelte';
// Replace emoji with:
<Lightbulb class="size-4 text-blue-600" />
```

- **Pros**: Consistent with app, accessible, follows guidelines
- **Cons**: Slightly different visual
- **Effort**: Small (10 minutes)
- **Risk**: Low

## Recommended Action

Replace 💡 emoji with Lucide `Lightbulb` icon in both locations.

## Technical Details

- **Affected Files**: `src/routes/courier/requests/+page.svelte`
- **Related Components**: None
- **Database Changes**: No

## Acceptance Criteria

- [ ] Emoji replaced with Lucide Lightbulb icon
- [ ] Icon styled consistently (size-4, text-blue-600)
- [ ] Both occurrences updated (lines 575, 682)
- [ ] Visual appearance acceptable

## Work Log

### 2026-01-29 - Approved for Work
**By:** Claude Triage System
**Actions:**
- Issue approved during triage session
- Status: ready
- Design conflicted with project guidelines

## Notes

Source: PR #6 code review - design conflicted with CLAUDE.md
