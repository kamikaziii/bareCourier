---
status: ready
priority: p2
issue_id: "179"
tags: [code-review, code-duplication, pr-7]
dependencies: []
---

# Duplicate `detectMunicipalityAndCheckZone` Function

## Problem Statement

The `detectMunicipalityAndCheckZone` function is copy-pasted in two files with nearly identical implementations (80+ lines duplicated). This violates DRY principles and makes maintenance harder.

## Findings

**Source:** Pattern Recognition Specialist Agent, Code Simplicity Reviewer Agent

**Location 1:** `src/routes/courier/services/new/+page.svelte` (lines 154-198)
**Location 2:** `src/routes/client/new/+page.svelte` (lines 110-149)

**Code pattern:**
```typescript
async function detectMunicipalityAndCheckZone(address: string) {
  checkingZone = true;
  // Try to extract municipality from address
  // Mapbox addresses for Portugal typically include the municipality
  // Format: "Street, Postal Code, Municipality, District, Portugal"
  const parts = address.split(',').map((p) => p.trim());

  let municipality: string | null = null;

  if (parts.length >= 4) {
    const potentialMunicipality = parts[parts.length - 3];
    if (potentialMunicipality && !/^\d{4}/.test(potentialMunicipality)) {
      municipality = potentialMunicipality;
    }
  }
  // ... (continues with similar logic)
}
```

**Impact:**
- 80+ lines of duplicated code
- Bug fixes need to be applied in two places
- Inconsistencies can creep in over time

## Proposed Solutions

### Solution 1: Extract to shared utility (Recommended)
Create `src/lib/services/municipality.ts`:
```typescript
export function extractMunicipalityFromAddress(address: string): string | null
export async function checkZoneStatus(supabase, municipality: string): Promise<boolean>
```
- **Pros:** DRY, testable, reusable
- **Cons:** Minor refactoring
- **Effort:** Small
- **Risk:** Low

### Solution 2: Extract to shared component
Create a hook or store that manages zone state
- **Pros:** Encapsulates state management too
- **Cons:** More complex
- **Effort:** Medium
- **Risk:** Low

## Technical Details

**Affected Files:**
- `src/routes/courier/services/new/+page.svelte`
- `src/routes/client/new/+page.svelte`
- New: `src/lib/services/municipality.ts` or `src/lib/services/address-parsing.ts`

## Acceptance Criteria

- [ ] Single implementation of municipality extraction
- [ ] Both forms use the shared utility
- [ ] Zone checking behavior unchanged

## Work Log

| Date | Action | Outcome |
|------|--------|---------|
| 2026-01-29 | PR #7 code review | Finding identified by pattern-recognition-specialist and code-simplicity-reviewer agents |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/7
