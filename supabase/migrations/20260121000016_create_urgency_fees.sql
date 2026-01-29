-- Phase 3: Urgency fees
-- Global urgency fee definitions (same-day, rush, etc.)

CREATE TABLE urgency_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  multiplier decimal(4,2) DEFAULT 1.0 NOT NULL, -- 1.5 = 50% extra
  flat_fee decimal(10,2) DEFAULT 0 NOT NULL,    -- Additional flat fee
  active boolean DEFAULT true NOT NULL,
  sort_order int DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Insert default urgency options
INSERT INTO urgency_fees (name, description, multiplier, flat_fee, sort_order) VALUES
  ('normal', 'Standard delivery (no rush)', 1.0, 0, 0),
  ('same_day', 'Same-day delivery', 1.25, 0, 1),
  ('rush', 'Rush delivery (within 2 hours)', 1.5, 2.50, 2),
  ('urgent', 'Urgent delivery (within 1 hour)', 2.0, 5.00, 3);

-- Enable RLS
ALTER TABLE urgency_fees ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Everyone can read, only courier can modify
CREATE POLICY "urgency_fees_select_all" ON urgency_fees
  FOR SELECT
  USING (true);

CREATE POLICY "urgency_fees_insert_courier" ON urgency_fees
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "urgency_fees_update_courier" ON urgency_fees
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );

CREATE POLICY "urgency_fees_delete_courier" ON urgency_fees
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (SELECT auth.uid())
      AND profiles.role = 'courier'
    )
  );
