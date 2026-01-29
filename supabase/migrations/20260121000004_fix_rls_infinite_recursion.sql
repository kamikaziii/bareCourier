-- Create a security definer function to check if user is courier
-- This bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_courier()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
    AND role = 'courier'
  );
$$;

-- Drop existing policies
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;

-- Recreate policies using the security definer function
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    id = (SELECT auth.uid()) OR public.is_courier()
  );

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT WITH CHECK (
    public.is_courier()
  );

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE USING (
    id = (SELECT auth.uid()) OR public.is_courier()
  );
