-- Phase 5: Set up pg_cron jobs for automated notifications
-- Note: pg_cron and pg_net need to be enabled via Supabase Dashboard first

-- Enable required extensions (run in SQL editor if not already enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
-- CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron to postgres
-- GRANT USAGE ON SCHEMA cron TO postgres;
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Store secrets in vault for secure access
-- Note: Run these manually in SQL editor with actual values:
-- SELECT vault.create_secret('https://kwqrvhbzxncaatxwmaky.supabase.co', 'project_url');
-- SELECT vault.create_secret('your-service-role-key', 'service_role_key');

-- Schedule past due check every 15 minutes
-- SELECT cron.schedule(
--   'check-past-due-services',
--   '*/15 * * * *',
--   $$
--   SELECT net.http_post(
--     url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/check-past-due',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
--     ),
--     body := jsonb_build_object('triggered_at', now())
--   ) AS request_id;
--   $$
-- );

-- Schedule daily summary at 8:00 AM (UTC - adjust for timezone)
-- For Portugal (UTC+0/+1), 8:00 local is approximately 7:00 or 8:00 UTC
-- SELECT cron.schedule(
--   'daily-summary-notification',
--   '0 8 * * *',
--   $$
--   SELECT net.http_post(
--     url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/daily-summary',
--     headers := jsonb_build_object(
--       'Content-Type', 'application/json',
--       'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
--     ),
--     body := jsonb_build_object('triggered_at', now())
--   ) AS request_id;
--   $$
-- );

-- Comment for documentation
COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension - Phase 5 uses vault secrets for cron job authentication';

-- Note: The cron jobs are commented out because:
-- 1. pg_cron must be enabled via Supabase Dashboard first
-- 2. Vault secrets must be created manually with service role key
-- 3. The schedule commands should be run after extensions are enabled
--
-- Manual setup steps:
-- 1. Go to Supabase Dashboard > Database > Extensions
-- 2. Enable pg_cron and pg_net extensions
-- 3. Run the vault.create_secret commands in SQL Editor
-- 4. Run the cron.schedule commands in SQL Editor
