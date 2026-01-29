-- Add workload_settings JSONB column to profiles
-- Stores courier's workload preferences

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS workload_settings JSONB DEFAULT '{
  "daily_hours": 8,
  "default_service_time_minutes": 15,
  "auto_lunch_start": "12:00",
  "auto_lunch_end": "13:00",
  "review_time": "18:00",
  "learning_enabled": true,
  "learned_service_time_minutes": null,
  "learning_sample_count": 0
}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.workload_settings IS 'Workload management settings: daily_hours, service time, lunch slot, review time, learning state';
