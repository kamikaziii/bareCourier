-- Add DELETE policies (only courier can delete)
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE USING (public.is_courier());

CREATE POLICY services_delete ON public.services
  FOR DELETE USING (public.is_courier());
