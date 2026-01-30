-- Add index for request_status queries (used in badge counts)
-- Composite index on (request_status, deleted_at) with partial index where deleted_at IS NULL
-- This speeds up badge count queries in courier/client layouts

CREATE INDEX IF NOT EXISTS idx_services_request_status_active
ON services(request_status, deleted_at)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_services_request_status_active IS
'Optimizes badge count queries filtering by request_status on active (non-deleted) services';
