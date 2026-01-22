-- Fix handle_new_user to always set role='client' for self-signups
-- Courier accounts must be created through admin process (prevents privilege escalation)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    'client',  -- ALWAYS client for self-signup (security fix)
    coalesce(new.raw_user_meta_data->>'name', new.email)
  );
  return new;
end;
$$;
