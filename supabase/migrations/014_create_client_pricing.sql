-- Phase 3: Client pricing configuration
-- Stores per-client pricing model and rates (for cost estimation, not invoicing)

CREATE TABLE client_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
  pricing_model text NOT NULL DEFAULT 'per_km' CHECK (pricing_model IN ('per_km', 'zone', 'flat_plus_km')),
  base_fee decimal(10,2) DEFAULT 0 NOT NULL,
  per_km_rate decimal(10,2) DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for fast lookups by client
CREATE INDEX idx_client_pricing_client_id ON client_pricing(client_id);

-- Enable RLS
ALTER TABLE client_pricing ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Courier can do everything, clients can view their own
CREATE POLICY "client_pricing_select_courier" ON client_pricing
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "client_pricing_select_own" ON client_pricing
  FOR SELECT
  USING (client_id = (SELECT auth.uid()));

CREATE POLICY "client_pricing_insert_courier" ON client_pricing
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "client_pricing_update_courier" ON client_pricing
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "client_pricing_delete_courier" ON client_pricing
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_client_pricing_updated_at()
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

CREATE TRIGGER client_pricing_updated_at
  BEFORE UPDATE ON client_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_client_pricing_updated_at();
