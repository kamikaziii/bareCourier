-- Migration: Fix race condition in display_id generation
-- Issue: Multiple concurrent INSERTs can generate duplicate display_ids
-- Solution: Use atomic UPSERT (INSERT ... ON CONFLICT DO UPDATE RETURNING)
--
-- Note: We only update the function, not the trigger. The existing trigger
-- (created in the original migration) will automatically use the updated function.
-- This avoids a window during deployment where no trigger exists.

-- Update trigger function with atomic UPSERT pattern
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

  current_year := (EXTRACT(YEAR FROM COALESCE(NEW.created_at, CURRENT_TIMESTAMP))::integer % 100)::smallint;

  -- Atomic UPSERT: INSERT or UPDATE in a single statement
  -- This is inherently race-condition-free without explicit locking
  INSERT INTO public.service_counters (year, last_number, updated_at)
  VALUES (current_year, 1, now())
  ON CONFLICT (year) DO UPDATE
    SET last_number = public.service_counters.last_number + 1,
        updated_at = now()
  RETURNING last_number INTO next_number;

  -- Overflow protection: #YY-NNNN format supports max 9999 services per year
  IF next_number > 9999 THEN
    RAISE EXCEPTION 'Service counter overflow for year %. Maximum 9999 services per year.', current_year;
  END IF;

  -- Format: #YY-NNNN (e.g., #26-0142)
  NEW.display_id := '#' ||
    lpad(current_year::text, 2, '0') || '-' ||
    lpad(next_number::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
