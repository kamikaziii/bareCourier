# Check Supabase Dashboard Email Templates for Brand Name

**Priority:** p2
**Status:** complete
**Created:** 2026-02-13
**Completed:** 2026-02-13

## Context

We renamed all code-level "bareCourier" references to "AS Estafetagem", but Supabase Auth has its own email templates configured **in the Dashboard UI** (not in code):

- Authentication > Email Templates

## Resolution

Configured all 5 auth email templates via `supabase/config.toml` with branded Portuguese HTML templates routed through Resend SMTP. Pushed to production with `supabase config push`.

- `supabase/templates/confirmation.html`
- `supabase/templates/invite.html`
- `supabase/templates/recovery.html`
- `supabase/templates/magic_link.html`
- `supabase/templates/email_change.html`

SMTP configured via Resend (`smtp.resend.com:465`), sender: `geral@asestafetagem.pt` / "AS Estafetagem".
