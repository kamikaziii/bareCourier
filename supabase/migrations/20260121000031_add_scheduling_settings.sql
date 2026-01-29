-- Migration: Add scheduling settings to profiles
-- Description: Adds timezone, time_slots, and working_days columns for courier scheduling configuration

-- Add timezone setting (default: Europe/Lisbon for Portugal)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  timezone text DEFAULT 'Europe/Lisbon';

-- Add time slot definitions as JSONB
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  time_slots jsonb DEFAULT '{
    "morning": { "start": "08:00", "end": "12:00" },
    "afternoon": { "start": "12:00", "end": "17:00" },
    "evening": { "start": "17:00", "end": "21:00" }
  }'::jsonb;

-- Add working days as JSONB array
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  working_days jsonb DEFAULT '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]'::jsonb;

-- Add comments for documentation
COMMENT ON COLUMN profiles.timezone IS 'IANA timezone identifier for the courier (e.g., Europe/Lisbon)';
COMMENT ON COLUMN profiles.time_slots IS 'Custom time slot definitions with start/end times for morning, afternoon, evening';
COMMENT ON COLUMN profiles.working_days IS 'Array of working day names (lowercase)';
