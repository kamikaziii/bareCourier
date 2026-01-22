-- Drop existing policies on services
DROP POLICY IF EXISTS services_select ON public.services;
DROP POLICY IF EXISTS services_insert ON public.services;
DROP POLICY IF EXISTS services_update ON public.services;

-- Recreate policies using the security definer function
CREATE POLICY services_select ON public.services
  FOR SELECT USING (
    client_id = (SELECT auth.uid()) OR public.is_courier()
  );

CREATE POLICY services_insert ON public.services
  FOR INSERT WITH CHECK (
    client_id = (SELECT auth.uid()) OR public.is_courier()
  );

CREATE POLICY services_update ON public.services
  FOR UPDATE USING (
    public.is_courier()
  );
