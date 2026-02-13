---
status: ready
priority: p2
issue_id: "299"
tags: [code-review, accessibility, svelte, pr-19]
dependencies: []
---

# Add aria-pressed and aria-label to chip buttons

## Problem Statement

The address suggestion chip buttons have a visual selected state (background color change) but lack `aria-pressed` to communicate selection to assistive technology. They also lack `aria-label` for screen readers to understand the default chip's Home icon meaning.

## Findings

- Chip buttons at `src/lib/components/AddressInput.svelte:192-205`
- Visual state changes via CSS class ternary (selected vs unselected)
- No `aria-pressed` attribute present
- Default chip shows Home icon but no text label for screen readers
- The unused `address_chip_default` i18n key could serve as `aria-label` (see #298)
- Found by: kieran-typescript-reviewer agent

## Proposed Solutions

### Option 1: Add aria-pressed and aria-label

**Approach:** Add accessibility attributes to the chip button:

```svelte
<button
  type="button"
  aria-pressed={selectedChipIndex === i}
  aria-label={suggestion.isDefault
    ? `${m.address_chip_default()}: ${suggestion.address}`
    : suggestion.address}
  class="..."
  onclick={() => handleChipSelect(suggestion, i)}
  {disabled}
>
```

**Pros:** Standard WCAG compliance, uses the otherwise-dead i18n key
**Cons:** None
**Effort:** 5 minutes
**Risk:** Low

## Recommended Action

## Technical Details

**Affected files:**
- `src/lib/components/AddressInput.svelte:192-205` — chip button element

## Resources

- **PR:** #19
- **Related:** #298 (i18n key)

## Acceptance Criteria

- [ ] Chip buttons have `aria-pressed` reflecting selection state
- [ ] Default chip has descriptive `aria-label` including "Default"/"Predefinido"
- [ ] Screen reader can distinguish selected vs unselected chips

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)

**Actions:**
- Identified missing accessibility attributes on toggle-like chip buttons
- Connected to unused i18n key finding
