-- Combined migration for break_logs constraints
-- Fixes: #165 (race condition), #172 (active break index), #173 (overlap prevention)

-- Enable btree_gist extension for EXCLUDE constraints with scalar types
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Unique partial index: Only one active break per courier at a time
-- This serves dual purpose:
-- 1. Prevents race condition in startBreak() (issue #165)
-- 2. Speeds up getCurrentBreak() queries (issue #172)
CREATE UNIQUE INDEX idx_break_logs_active_break
  ON break_logs (courier_id)
  WHERE ended_at IS NULL;

-- EXCLUDE constraint: Prevent overlapping breaks (issue #173)
-- Uses [) bounds (closed-open) which is PostgreSQL convention
-- COALESCE handles active breaks (ended_at IS NULL) by treating them as infinite
ALTER TABLE break_logs
  ADD CONSTRAINT no_overlapping_breaks
  EXCLUDE USING GIST (
    courier_id WITH =,
    tstzrange(started_at, COALESCE(ended_at, 'infinity'), '[)') WITH &&
  );
