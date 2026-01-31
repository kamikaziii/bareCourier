-- Migration: Fix race condition in display_id generation
-- Issue: Multiple concurrent INSERTs can generate duplicate display_ids
-- Solution: Use SELECT ... FOR UPDATE to lock counter row before incrementing

-- Drop existing trigger
DROP TRIGGER IF EXISTS services_before_insert_display_id ON services;

-- Recreate trigger function with proper locking
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

  -- Lock the entire counter table to prevent race conditions
  -- This ensures only one transaction can generate display_ids at a time
  LOCK TABLE service_counters IN EXCLUSIVE MODE;

  -- Try to get the current counter for this year with row lock
  SELECT last_number INTO next_number
  FROM service_counters
  WHERE year = current_year
  FOR UPDATE;

  IF NOT FOUND THEN
    -- First service for this year
    INSERT INTO service_counters (year, last_number, updated_at)
    VALUES (current_year, 1, now());
    next_number := 1;
  ELSE
    -- Increment counter atomically
    UPDATE service_counters
    SET last_number = last_number + 1,
        updated_at = now()
    WHERE year = current_year
    RETURNING last_number INTO next_number;
  END IF;

  -- Format: #YY-NNNN (e.g., #26-0142)
  NEW.display_id := '#' ||
    lpad(current_year::text, 2, '0') || '-' ||
    lpad(next_number::text, 4, '0');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Reattach trigger to services table
CREATE TRIGGER services_before_insert_display_id
  BEFORE INSERT ON services
  FOR EACH ROW
  EXECUTE FUNCTION generate_service_display_id();
