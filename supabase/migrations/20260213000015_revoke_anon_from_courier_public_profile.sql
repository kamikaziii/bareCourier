-- Defense-in-depth: explicitly revoke anon access to courier_public_profile view.
-- Supabase does not grant anon access to new views by default, but explicit
-- REVOKE ensures this holds even if default privileges change.
REVOKE ALL ON public.courier_public_profile FROM anon;
