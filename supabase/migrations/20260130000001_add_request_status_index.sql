-- Add index for request_status queries (used in badge counts)
-- Composite index on (request_status, deleted_at) with partial index where deleted_at IS NULL
-- This speeds up badge count queries in courier/client layouts
--
-- CONCURRENTLY: Creates index without blocking writes (zero downtime)
-- Lock behavior: SHARE UPDATE EXCLUSIVE (allows SELECT/INSERT/UPDATE/DELETE)
-- Build time: Minimal impact on active traffic
--
-- ROLLBACK (if needed):
-- DROP INDEX CONCURRENTLY IF EXISTS idx_services_request_status_active;
--
-- NOTE: Must use CONCURRENTLY to avoid table locks during rollback

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_services_request_status_active
ON services(request_status, deleted_at)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON INDEX idx_services_request_status_active IS
'Optimizes badge count queries filtering by request_status on active (non-deleted) services';
