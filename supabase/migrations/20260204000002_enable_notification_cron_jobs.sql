-- Enable cron jobs for automated notifications
-- Prerequisites: pg_cron and pg_net extensions must be enabled via Dashboard
-- Vault secrets (project_url, service_role_key) must be configured

-- Schedule past due check every 15 minutes
-- The edge function handles the time-window check internally
SELECT cron.schedule(
  'check-past-due-services',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/check-past-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);

-- Schedule daily summary every 15 minutes
-- The edge function checks if current time matches courier's preferred time
SELECT cron.schedule(
  'daily-summary-notification',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);

-- Add comments for documentation
COMMENT ON EXTENSION pg_cron IS 'Cron job scheduler for PostgreSQL - used for past-due checks and daily summaries';
