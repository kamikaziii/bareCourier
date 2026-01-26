-- Phase 5 Fix: Add tracking for past-due notification deduplication
-- Edge Functions are stateless, so we need database persistence

ALTER TABLE services
ADD COLUMN IF NOT EXISTS last_past_due_notification_at timestamptz;

-- Index for efficient queries on past-due services
CREATE INDEX IF NOT EXISTS idx_services_last_past_due_notification
ON services (last_past_due_notification_at)
WHERE status = 'pending' AND deleted_at IS NULL;

COMMENT ON COLUMN services.last_past_due_notification_at IS 'Timestamp of last past-due reminder notification sent for this service';
