-- Add past due settings to profiles (courier configuration)
-- These settings control urgency thresholds and client rescheduling policies

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS
  past_due_settings jsonb DEFAULT '{
    "gracePeriodStandard": 30,
    "gracePeriodSpecific": 15,
    "thresholdApproaching": 120,
    "thresholdUrgent": 60,
    "thresholdCriticalHours": 24,
    "allowClientReschedule": true,
    "clientMinNoticeHours": 24,
    "clientMaxReschedules": 3
  }'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.past_due_settings IS 'Courier-configurable past due thresholds and client rescheduling policies';
