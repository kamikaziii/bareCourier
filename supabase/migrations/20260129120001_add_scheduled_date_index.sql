-- Migration: Add index on scheduled_date for workload queries
-- Purpose: Improve performance of calculateDayWorkload() which queries by scheduled_date
-- The partial index excludes soft-deleted records for smaller index size and better performance

CREATE INDEX IF NOT EXISTS idx_services_scheduled_date
ON services(scheduled_date)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_services_scheduled_date IS 'Partial index for workload queries filtering by scheduled_date on non-deleted services';
