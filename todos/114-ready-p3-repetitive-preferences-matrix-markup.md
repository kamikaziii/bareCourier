---
status: ready
priority: p3
issue_id: "114"
tags: [code-quality, dry, code-review]
dependencies: []
---

# Repetitive Preferences Matrix Markup in NotificationsTab

## Problem Statement
5 nearly identical 22-line grid rows in `NotificationsTab.svelte:222-344` for the notification preferences matrix. Only the category key and i18n message functions differ.

## Findings
- Location: `src/routes/courier/settings/NotificationsTab.svelte:222-344`
- 5 rows x ~22 lines = 110+ lines of repetitive markup
- Each row differs only by category name and message function references

## Proposed Solutions

### Option 1: Extract to `{#snippet categoryRow(category, titleMsg, descMsg)}`
- **Pros**: Reduces 110 lines to ~25 lines, future categories are 1-line additions
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Recommended Action
Create a snippet and call it 5 times with different parameters.

## Technical Details
- **Affected Files**: `src/routes/courier/settings/NotificationsTab.svelte`
- **Database Changes**: No

## Acceptance Criteria
- [ ] Single snippet renders all 5 category rows
- [ ] Visual output unchanged
- [ ] Adding a new category requires only 1 new line

## Work Log

### 2026-01-27 - Approved for Work
**By:** Claude Triage System

## Notes
Source: Code review of commit 158e99d
