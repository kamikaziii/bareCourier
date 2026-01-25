-- Add fields for pending client reschedule requests
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_date date;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_time_slot text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_time text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_reason text;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_requested_at timestamptz;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pending_reschedule_requested_by uuid REFERENCES profiles(id);

-- Comment for documentation
COMMENT ON COLUMN services.pending_reschedule_date IS 'Client-requested reschedule date awaiting courier approval';
