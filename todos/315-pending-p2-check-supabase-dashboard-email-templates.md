# Check Supabase Dashboard Email Templates for Brand Name

**Priority:** p2
**Status:** pending
**Created:** 2026-02-13

## Context

We renamed all code-level "bareCourier" references to "AS Estafetagem", but Supabase Auth has its own email templates configured **in the Dashboard UI** (not in code):

- Authentication > Email Templates

## Action Required

Go to the **Supabase Dashboard** → Authentication → Email Templates and check/update:

1. **Confirm signup** email — subject and body
2. **Magic link** email — subject and body
3. **Change email address** email — subject and body
4. **Reset password** email — subject and body
5. **Invite user** email — subject and body (if using Supabase's built-in invite)

Replace any "bareCourier" references with "AS Estafetagem" in both subject lines and email body content.
