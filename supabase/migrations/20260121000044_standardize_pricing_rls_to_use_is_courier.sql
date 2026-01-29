-- Migration: Standardize pricing table RLS policies to use is_courier() helper
-- Resolves TODO #107: Inconsistent use of is_courier() helper
--
-- The is_courier() function is a SECURITY DEFINER function that:
-- 1. Prevents infinite recursion when checking profiles table
-- 2. Has proper search_path set to '' for security
-- 3. Is used consistently across profiles, services, and notifications tables
--
-- This migration updates client_pricing, pricing_zones, and urgency_fees
-- to use the same pattern for consistency and maintainability.

-- ============================================
-- client_pricing table policies
-- ============================================

DROP POLICY IF EXISTS "client_pricing_select_courier" ON public.client_pricing;
CREATE POLICY "client_pricing_select_courier" ON public.client_pricing
  FOR SELECT
  USING (public.is_courier());

DROP POLICY IF EXISTS "client_pricing_insert_courier" ON public.client_pricing;
CREATE POLICY "client_pricing_insert_courier" ON public.client_pricing
  FOR INSERT
  WITH CHECK (public.is_courier());

DROP POLICY IF EXISTS "client_pricing_update_courier" ON public.client_pricing;
CREATE POLICY "client_pricing_update_courier" ON public.client_pricing
  FOR UPDATE
  USING (public.is_courier());

DROP POLICY IF EXISTS "client_pricing_delete_courier" ON public.client_pricing;
CREATE POLICY "client_pricing_delete_courier" ON public.client_pricing
  FOR DELETE
  USING (public.is_courier());

-- ============================================
-- pricing_zones table policies
-- ============================================

DROP POLICY IF EXISTS "pricing_zones_select_courier" ON public.pricing_zones;
CREATE POLICY "pricing_zones_select_courier" ON public.pricing_zones
  FOR SELECT
  USING (public.is_courier());

DROP POLICY IF EXISTS "pricing_zones_insert_courier" ON public.pricing_zones;
CREATE POLICY "pricing_zones_insert_courier" ON public.pricing_zones
  FOR INSERT
  WITH CHECK (public.is_courier());

DROP POLICY IF EXISTS "pricing_zones_update_courier" ON public.pricing_zones;
CREATE POLICY "pricing_zones_update_courier" ON public.pricing_zones
  FOR UPDATE
  USING (public.is_courier());

DROP POLICY IF EXISTS "pricing_zones_delete_courier" ON public.pricing_zones;
CREATE POLICY "pricing_zones_delete_courier" ON public.pricing_zones
  FOR DELETE
  USING (public.is_courier());

-- ============================================
-- urgency_fees table policies
-- ============================================

-- Note: urgency_fees_select_all stays as USING (true) since everyone can read
-- Only the write policies need updating

DROP POLICY IF EXISTS "urgency_fees_insert_courier" ON public.urgency_fees;
CREATE POLICY "urgency_fees_insert_courier" ON public.urgency_fees
  FOR INSERT
  WITH CHECK (public.is_courier());

DROP POLICY IF EXISTS "urgency_fees_update_courier" ON public.urgency_fees;
CREATE POLICY "urgency_fees_update_courier" ON public.urgency_fees
  FOR UPDATE
  USING (public.is_courier());

DROP POLICY IF EXISTS "urgency_fees_delete_courier" ON public.urgency_fees;
CREATE POLICY "urgency_fees_delete_courier" ON public.urgency_fees
  FOR DELETE
  USING (public.is_courier());
