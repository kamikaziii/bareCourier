-- Add composite index for past-due check cron job query
-- Optimizes: SELECT ... FROM services WHERE status = 'pending' AND scheduled_date <= X AND deleted_at IS NULL

CREATE INDEX IF NOT EXISTS idx_services_past_due_check
ON services(status, scheduled_date)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_services_past_due_check IS
'Optimizes past-due check cron job query filtering pending services by scheduled date';
