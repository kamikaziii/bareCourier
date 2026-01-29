-- Migration: Add unique constraint on service_types name for active types
-- Prevents duplicate service type names among active types (case-insensitive)
-- Using partial index to allow same name for inactive (archived) types

-- Prevent duplicate service type names among active types
-- Using partial index to allow same name for inactive (archived) types
CREATE UNIQUE INDEX idx_service_types_name_active_unique
  ON service_types (lower(name))
  WHERE active = true;

COMMENT ON INDEX idx_service_types_name_active_unique IS
  'Prevents duplicate service type names among active types (case-insensitive)';
