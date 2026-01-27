---
status: complete
priority: p3
issue_id: "131"
tags: [code-review, security]
dependencies: []
---

# CSV Filename Not Fully Sanitized

## Problem Statement
Client name used in CSV filename only has whitespace replaced. Browser `download` attribute sanitizes further, so minimal risk, but could be improved.

## Findings
- Source: Security Sentinel
- Location: `src/routes/courier/billing/[client_id]/+page.svelte`

## Proposed Solutions

### Option A: Replace non-alphanumeric chars
- Use regex: `name.replace(/[^a-zA-Z0-9-_]/g, '_')`
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria
- [ ] Filenames contain only safe characters

## Work Log
| 2026-01-27 | Approved | Triage: verified and approved for work |
| Date | Action | Notes |
|------|--------|-------|
| 2026-01-27 | Created | From multi-agent code review of VAT implementation |
