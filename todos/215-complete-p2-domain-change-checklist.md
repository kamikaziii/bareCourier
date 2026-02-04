---
status: complete
priority: p2
issue_id: "215"
tags: [infrastructure, deployment, checklist]
dependencies: []
completed_at: 2026-02-04
---

# Domain Change Checklist - All Hardcoded URLs

## Resolution

This TODO has been resolved by creating comprehensive deployment documentation.

**Documentation created:** `docs/DEPLOYMENT_CHECKLIST.md`

The checklist includes:
- Domain change instructions with all file locations
- Pre-deployment verification steps
- Post-deployment verification steps
- Quick reference for files with domain references

## Original Problem Statement

When deploying to a client's custom domain (not `barecourier.vercel.app`), multiple files contain hardcoded domain references that must be updated.

**Impact:** CORS failures, broken auth redirects, incorrect SEO links if not updated.

## Summary of Files to Update

See `docs/DEPLOYMENT_CHECKLIST.md` for full details. Quick reference:

1. `supabase/config.toml` - Auth URLs
2. Edge functions (5 files) - CORS origins
3. `src/routes/+layout.svelte` - SEO links
4. `supabase/functions/send-push/index.ts` - VAPID subject
5. `src/lib/services/offline-store.ts` - IndexedDB names (optional)
6. `package.json` - Package name (optional)

## Notes

- The actual domain changes are intentionally deferred until deployment time
- Consider refactoring to use environment variables before client deployment
- The CORS pattern `origin.includes("barecourier")` in edge functions needs updating for non-barecourier domains
