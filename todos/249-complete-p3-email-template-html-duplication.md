---
status: ready
priority: p3
issue_id: "249"
tags: [code-review, code-quality, dry, pr-13]
dependencies: []
---

# Email Template HTML Duplication (~350 LOC)

## Problem Statement

The `generateEmailHtml` function contains a 12-case switch statement where each case has nearly identical HTML boilerplate. This violates DRY principles and makes templates harder to maintain.

## Findings

**Source:** code-simplicity-reviewer agent

**Location:** `supabase/functions/send-email/index.ts` lines 98-436

**Current pattern:**
```typescript
switch (template) {
  case "new_request":
    return {
      subject: emailT("email_new_request_subject", locale, {...}),
      html: `
        <!DOCTYPE html>
        <html>
        <head>${baseStyles}</head>
        <body>
          <div class="container">
            <div class="header">...</div>
            <div class="content">...</div>
            <div class="footer">...</div>
          </div>
        </body>
        </html>
      `,
    };
  // 11 more nearly identical cases...
}
```

**Impact:**
- ~350 lines of repetitive HTML
- Each new template requires copy-paste
- Style changes require 12 updates
- High maintenance burden

## Proposed Solutions

### Solution 1: Template Builder Function (Recommended)
**Pros:** Significant code reduction, easier maintenance
**Cons:** Slight learning curve
**Effort:** Medium
**Risk:** Low

```typescript
function wrapEmail(options: {
  headerColor: string;
  title: string;
  content: string;
  button?: { text: string; href: string; color?: string };
  footer?: string;
}) {
  return `<!DOCTYPE html>
    <html>
    <head>${baseStyles}</head>
    <body>
      <div class="container">
        <div class="header" style="background: ${options.headerColor};">
          <h1>${options.title}</h1>
        </div>
        <div class="content">
          ${options.content}
          ${options.button ? `<a href="${options.button.href}" class="button" style="background: ${options.button.color || options.headerColor};">${options.button.text}</a>` : ''}
        </div>
        <div class="footer">
          <p>${options.footer || emailT('email_footer', locale)}</p>
        </div>
      </div>
    </body>
    </html>`;
}
```

### Solution 2: External Template Files
**Pros:** Separation of concerns
**Cons:** More complex build process
**Effort:** Large
**Risk:** Medium

## Recommended Action

<!-- To be filled during triage -->

## Technical Details

**Affected Files:**
- `supabase/functions/send-email/index.ts`

**Estimated LOC Reduction:** 200+ lines

## Acceptance Criteria

- [ ] Single template wrapper function
- [ ] Each case only defines unique content
- [ ] All emails still render correctly
- [ ] Style changes require single update

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-04 | Identified during PR #13 code review | Major DRY violation |

## Resources

- PR: https://github.com/kamikaziii/bareCourier/pull/13
