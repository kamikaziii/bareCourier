-- Migration: Add service display IDs, recipient fields, and label branding

-- 1. Create counter table for year-based sequential IDs
CREATE TABLE IF NOT EXISTS service_counters (
  year smallint PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. RLS for counter table (trigger-only access)
ALTER TABLE service_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_counters_no_direct_access"
  ON service_counters FOR ALL
  USING (false);

-- 3. Add new columns to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS display_id text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS customer_reference text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS recipient_phone text;

-- 4. Add new columns to profiles (label branding)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS label_business_name text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS label_tagline text;

-- 5. Create the trigger function for auto-generating display_id
CREATE OR REPLACE FUNCTION generate_service_display_id()
RETURNS TRIGGER AS $$
DECLARE
  current_year smallint;
  next_number integer;
BEGIN
  -- Skip if display_id already set
  IF NEW.display_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  current_year := (EXTRACT(YEAR FROM CURRENT_DATE)::integer % 100)::smallint;

  -- Atomically increment the counter for this year
  INSERT INTO service_counters (year, last_number, updated_at)
  VALUES (current_year, 1, now())
  ON CONFLICT (year) DO UPDATE
    SET last_number = service_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO next_number;

  -- Format: #YY-NNNN (e.g., #26-0142)
  NEW.display_id := '#' ||
    lpad(current_year::text, 2, '0') || '-' ||
    lpad(next_number::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- 6. Attach trigger to services table
DROP TRIGGER IF EXISTS services_before_insert_display_id ON services;
CREATE TRIGGER services_before_insert_display_id
  BEFORE INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION generate_service_display_id();

-- 7. Backfill existing services (assign IDs in creation order per year)
WITH numbered AS (
  SELECT
    id,
    (EXTRACT(YEAR FROM created_at)::integer % 100) as yr,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM created_at)
      ORDER BY created_at
    ) as seq
  FROM services
  WHERE display_id IS NULL
)
UPDATE services s
SET display_id = '#' || lpad(n.yr::text, 2, '0') || '-' || lpad(n.seq::text, 4, '0')
FROM numbered n
WHERE s.id = n.id;

-- 8. Update counter table with current max values
INSERT INTO service_counters (year, last_number, updated_at)
SELECT
  (EXTRACT(YEAR FROM created_at)::integer % 100)::smallint,
  COUNT(*)::integer,
  now()
FROM services
WHERE display_id IS NOT NULL
GROUP BY EXTRACT(YEAR FROM created_at)
ON CONFLICT (year) DO UPDATE
SET last_number = GREATEST(service_counters.last_number, EXCLUDED.last_number);

-- 9. Add unique index for display_id lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_services_display_id_unique
  ON services(display_id) WHERE display_id IS NOT NULL;
