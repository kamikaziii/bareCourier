---
status: ready
priority: p1
issue_id: "259"
tags: [code-review, security, error-handling]
dependencies: []
---

# Error Message Disclosure in Client Settings Actions

## Problem Statement

Two form actions in the client settings page return raw database error messages to users. This can expose schema information (table names, column names, constraint names).

**Why it matters:**
- Database errors reveal internal structure
- Inconsistent with other actions in the same file that sanitize errors
- Security best practice violation

## Findings

**Location:** `src/routes/client/settings/+page.server.ts`

### Action 1: updateProfile (lines 97-98)
```typescript
if (error) {
    return fail(500, { error: error.message });  // Raw DB error
}
```

### Action 2: updateLocation (lines 124-125)
```typescript
if (error) {
    return fail(500, { error: error.message });  // Raw DB error
}
```

### Contrast with correct pattern (same file):

**updateNotificationPreferences (lines 169-170):**
```typescript
if (error) {
    return fail(500, { error: 'Failed to update notification preferences' });  // Sanitized
}
```

**updateTimezone (lines 194-195):**
```typescript
if (error) {
    return fail(500, { error: 'Failed to update timezone' });  // Sanitized
}
```

## Proposed Solutions

### Option A: Match existing sanitized pattern (Recommended)
**Pros:** Consistent with existing code in same file
**Cons:** None
**Effort:** Small
**Risk:** Very Low

```typescript
// updateProfile
if (error) {
    return fail(500, { error: 'Failed to update profile. Please try again.' });
}

// updateLocation
if (error) {
    return fail(500, { error: 'Failed to update location. Please try again.' });
}
```

### Option B: Use i18n messages
**Pros:** Translatable error messages
**Cons:** Requires new message keys
**Effort:** Small
**Risk:** Very Low

## Recommended Action

Implement Option A for quick fix, matching the existing pattern in the same file.

## Technical Details

- **Affected file:** `src/routes/client/settings/+page.server.ts`
- **Lines to change:** 98, 125
- **Pattern to follow:** Lines 170, 195 (same file)

## Acceptance Criteria

- [ ] `updateProfile` action returns sanitized error message
- [ ] `updateLocation` action returns sanitized error message
- [ ] Original errors are logged server-side for debugging
- [ ] All 4 actions in the file use consistent error handling

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Created from post-merge audit | Consistency within files matters |

## Resources

- OWASP Error Handling: https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html
