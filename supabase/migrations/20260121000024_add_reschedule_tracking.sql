-- Add reschedule tracking fields to services
ALTER TABLE services ADD COLUMN IF NOT EXISTS
  reschedule_count integer DEFAULT 0;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_at timestamptz;

ALTER TABLE services ADD COLUMN IF NOT EXISTS
  last_rescheduled_by uuid REFERENCES profiles(id);

-- Index for efficient queries on rescheduled services
CREATE INDEX IF NOT EXISTS idx_services_rescheduled
  ON services(last_rescheduled_at)
  WHERE last_rescheduled_at IS NOT NULL;
