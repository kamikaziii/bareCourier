---
status: complete
priority: p2
issue_id: "138"
tags: [security, service-worker, privacy]
dependencies: []
---

# Service Worker Caches Sensitive Data Past Logout

## Problem Statement
The `supabase-data` cache (NetworkFirst strategy) stores Supabase REST API responses for 24 hours with up to 100 entries. After logout, cached client names, addresses, phone numbers, delivery locations, and pricing persist in the browser. On shared devices, the next user can access this data.

## Findings
- Source: Security Sentinel (full review 2026-01-27)
- Location: `src/service-worker.ts:109-123`
- Cache name: `supabase-data`
- Retention: 24 hours, 100 entries

## Proposed Solutions

### Option 1: Clear cache on logout via message
- Add `message` event listener in service worker for `CLEAR_AUTH_CACHE`
- Call `caches.delete('supabase-data')` when received
- Send message from logout flow in layout
- **Effort**: Small (30 minutes)
- **Risk**: Low

## Acceptance Criteria
- [ ] `supabase-data` cache cleared on logout
- [ ] Service worker listens for clear message
- [ ] Logout flow sends clear message before redirect
