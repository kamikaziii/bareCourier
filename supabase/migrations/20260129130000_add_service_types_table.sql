-- Migration: Add service_types table for type-based pricing
-- Allows courier to define service types (Dental, Óptica, etc.) with fixed prices
-- This supports the new type-based pricing model alongside existing per-km pricing

CREATE TABLE service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric(10,2) NOT NULL,
  description text,
  active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for ordering (used in dropdowns and listings)
CREATE INDEX idx_service_types_sort ON service_types(sort_order, name);

-- Enable RLS
ALTER TABLE service_types ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Use is_courier() helper for consistency with other tables

-- Courier can read all service types
CREATE POLICY "service_types_select_courier" ON service_types
  FOR SELECT
  USING (public.is_courier());

-- Clients can read active service types only
CREATE POLICY "service_types_select_client" ON service_types
  FOR SELECT
  USING (active = true);

-- Courier can insert new service types
CREATE POLICY "service_types_insert_courier" ON service_types
  FOR INSERT
  WITH CHECK (public.is_courier());

-- Courier can update service types
CREATE POLICY "service_types_update_courier" ON service_types
  FOR UPDATE
  USING (public.is_courier());

-- Courier can delete service types
CREATE POLICY "service_types_delete_courier" ON service_types
  FOR DELETE
  USING (public.is_courier());

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_service_types_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER service_types_updated_at
  BEFORE UPDATE ON service_types
  FOR EACH ROW
  EXECUTE FUNCTION update_service_types_updated_at();

COMMENT ON TABLE service_types IS 'Service types for type-based pricing (Dental, Óptica, etc.)';
