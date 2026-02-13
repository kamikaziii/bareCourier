---
status: ready
priority: p2
issue_id: "296"
tags: [code-review, svelte, naming, pr-19]
dependencies: []
---

# Resolve suggestions naming collision in AddressInput

## Problem Statement

The `AddressInput` component has a prop named `suggestions` (type `AddressSuggestion[]`) and an internal `$state` variable also named `suggestions` (type `GeocodingResult[]`). The prop is aliased to `addressSuggestions` on destructure, creating a confusing naming situation where the external data has the longer qualified name while the internal state has the shorter prominent name.

## Findings

- Prop interface at `src/lib/components/AddressInput.svelte:21`: `suggestions?: AddressSuggestion[]`
- Destructured with alias at line 31: `suggestions: addressSuggestions = []`
- Internal state at line 34: `let suggestions = $state<GeocodingResult[]>([])`
- Template uses `suggestions` (line 168, 174) for Mapbox results and `addressSuggestions` (line 189) for chips
- The semantic meaning is inverted: external data has the longer name, internal state has the shorter name
- Found by: kieran-typescript-reviewer, architecture-strategist, pattern-recognition-specialist agents (all flagged independently)

## Proposed Solutions

### Option 1: Rename internal state to geocodingResults

**Approach:** Rename the internal Mapbox `suggestions` state to `geocodingResults`. Keep the prop as `suggestions` and drop the alias.

**Changes:**
- `let suggestions = $state<GeocodingResult[]>([])` → `let geocodingResults = $state<GeocodingResult[]>([])`
- Update all internal references (handleInput, handleSelect, handleFocus, handleChipSelect, template)
- Drop the destructure alias: `suggestions: addressSuggestions = []` → `suggestions = []`

**Pros:** Eliminates all ambiguity, self-documenting names
**Cons:** Touches ~12 references within the component
**Effort:** 15 minutes
**Risk:** Low

## Recommended Action

## Technical Details

**Affected files:**
- `src/lib/components/AddressInput.svelte` — lines 21, 31, 34, 51, 53, 56, 66, 77, 107, 109, 168, 174

## Resources

- **PR:** #19

## Acceptance Criteria

- [ ] No two variables in AddressInput share the name "suggestions"
- [ ] Prop name and usage are consistent (no aliasing needed)
- [ ] `pnpm run check` passes
- [ ] All existing AddressInput consumers unaffected (prop is optional, defaults to `[]`)

## Work Log

### 2026-02-13 - Initial Discovery

**By:** Claude Code (PR #19 review)

**Actions:**
- Three independent review agents flagged the same naming collision
- Traced all 12+ references to the internal `suggestions` state

**Learnings:**
- Svelte 5 destructuring with alias works but creates a maintenance trap when names collide
