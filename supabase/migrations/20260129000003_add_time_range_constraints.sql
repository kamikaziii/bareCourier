-- Add CHECK constraints to enforce valid time ranges

-- For break_logs: ended_at must be after started_at (when not null)
ALTER TABLE break_logs
  ADD CONSTRAINT valid_break_time_range
  CHECK (ended_at IS NULL OR ended_at > started_at);

-- For delivery_time_logs: completed_at must be after started_at
ALTER TABLE delivery_time_logs
  ADD CONSTRAINT valid_time_range
  CHECK (completed_at > started_at);
