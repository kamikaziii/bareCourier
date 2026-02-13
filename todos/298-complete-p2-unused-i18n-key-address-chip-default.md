---
status: complete
priority: p2
issue_id: "298"
tags: [code-review, i18n, dead-code, pr-19]
dependencies: []
---

# Remove or use dead i18n key address_chip_default

## Problem Statement

The `address_chip_default` i18n key is defined in both locale files but never referenced in any component code. The default chip is distinguished by the Home icon via `suggestion.isDefault`, not by text. This is dead code that adds noise to the i18n files.

## Findings

- `messages/en.json:346`: `"address_chip_default": "Default"`
- `messages/pt-PT.json:346`: `"address_chip_default": "Predefinido"`
- Grep across entire codebase: only found in message files and the design plan doc
- Not imported or called via `m.address_chip_default()` anywhere
- Found by: kieran-typescript-reviewer, architecture-strategist, pattern-recognition-specialist agents

## Proposed Solutions

### Option 1: Use it as aria-label on default chip (recommended)

**Approach:** Wire the key into the default chip button as an `aria-label`, which also fixes the accessibility gap (finding #299).

```svelte
aria-label={suggestion.isDefault
    ? `${m.address_chip_default()}: ${suggestion.address}`
    : suggestion.address}
```

**Pros:** Gives the key a purpose, improves accessibility
**Cons:** Requires importing `m` in AddressInput (already imported)
**Effort:** 5 minutes
**Risk:** Low

---

### Option 2: Remove the key

**Approach:** Delete the key from both locale files.

**Pros:** Clean, no dead code
**Cons:** Loses the translation work if needed later
**Effort:** 2 minutes
**Risk:** Low

## Recommended Action

## Technical Details

**Affected files:**
- `messages/en.json:346`
- `messages/pt-PT.json:346`
- `src/lib/components/AddressInput.svelte` (if using for aria-label)

## Resources

- **PR:** #19
- **Related:** #299 (accessibility)

## Acceptance Criteria

- [ ] The key is either used in code OR removed from locale files
- [ ] No unused i18n keys in the PR's scope

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)

**Actions:**
- Grep confirmed no code references to `address_chip_default`
- Multiple agents independently flagged as dead code
