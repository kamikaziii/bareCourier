---
status: complete
priority: p3
issue_id: "113"
tags: [code-quality, dry, code-review]
dependencies: []
---

# Duplicated Notification Item Template in NotificationBell

## Problem Statement
Lines 259-289 and 296-326 in `NotificationBell.svelte` are identical 30-line blocks rendering notification items - one for "Today" group and one for "Earlier" group. Should be a Svelte 5 snippet.

## Findings
- Location: `src/lib/components/NotificationBell.svelte:259-326`
- Two `{#each}` blocks with character-identical template content
- Only the section header and source array differ

## Proposed Solutions

### Option 1: Extract to `{#snippet notificationItem(notification)}`
- **Pros**: Eliminates 30 lines of duplication, idiomatic Svelte 5
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Extract notification item rendering into a Svelte 5 snippet.

## Technical Details
- **Affected Files**: `src/lib/components/NotificationBell.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Single snippet used for both Today and Earlier groups
- [ ] Notification rendering unchanged visually

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Code review of commit 158e99d
