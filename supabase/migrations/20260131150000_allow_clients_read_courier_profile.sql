-- Allow clients to read courier's profile for pricing information
-- This is needed so clients can see the courier's pricing_mode, type-based pricing settings, etc.

-- Drop existing profiles SELECT policy
DROP POLICY IF EXISTS profiles_select ON public.profiles;

-- Recreate with extended permissions
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT USING (
    -- Users can read their own profile
    id = (SELECT auth.uid())
    OR
    -- Couriers can read all profiles
    public.is_courier()
    OR
    -- Clients can read the courier's profile (for pricing info)
    (role = 'courier')
  );

COMMENT ON POLICY profiles_select ON public.profiles IS
  'Users can read their own profile, couriers can read all profiles, clients can read courier profile for pricing info';
