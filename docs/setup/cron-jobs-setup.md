# Cron Jobs Setup Guide

This guide walks you through enabling scheduled notifications in bareCourier using Supabase's pg_cron extension.

## Overview

bareCourier uses two scheduled jobs:
1. **check-past-due-services** - Runs every 15 minutes to notify courier about overdue deliveries
2. **daily-summary-notification** - Runs daily at 8:00 AM UTC (9:00 AM Lisbon time) to send courier a summary of pending services

## Prerequisites

- Supabase project with Database access
- Access to SQL Editor in Supabase Dashboard
- Service Role Key (found in Settings → API)

## Setup Steps

### Step 1: Enable Required Extensions

1. Navigate to **Database → Extensions** in Supabase Dashboard
2. Search for and enable the following extensions:
   - `pg_cron` - PostgreSQL job scheduler
   - `pg_net` - HTTP requests from database

3. Verify extensions are enabled by running in SQL Editor:
   ```sql
   SELECT * FROM pg_extension WHERE extname IN ('pg_cron', 'pg_net');
   ```

   Expected output:
   ```
   extname  | extowner | extnamespace | extrelocatable | extversion
   ---------+----------+--------------+----------------+------------
   pg_cron  |       10 |         2200 | f              | 1.5
   pg_net   |       10 |         2200 | f              | 0.7.1
   ```

### Step 2: Create Vault Secrets

Run the following commands in SQL Editor to store your Supabase credentials securely:

```sql
-- Store project URL (replace with your actual project URL)
SELECT vault.create_secret(
  'https://your-project-id.supabase.co',
  'project_url'
);

-- Store service role key (get from Settings → API in Supabase Dashboard)
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',  -- Your actual service role key
  'service_role_key'
);
```

**⚠️ Security Warning:** Never commit your service role key to version control. This key grants full admin access to your database.

Verify secrets were created:
```sql
SELECT name FROM vault.decrypted_secrets;
```

Expected output:
```
       name
------------------
 project_url
 service_role_key
```

### Step 3: Schedule the Jobs

#### Job 1: Check Past-Due Services (Every 15 minutes)

```sql
SELECT cron.schedule(
  'check-past-due-services',
  '*/15 * * * *',  -- Every 15 minutes
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/check-past-due',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);
```

#### Job 2: Daily Summary (8:00 AM UTC / 9:00 AM Lisbon)

```sql
SELECT cron.schedule(
  'daily-summary-notification',
  '0 8 * * *',  -- Daily at 08:00 UTC
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
           || '/functions/v1/daily-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')
    ),
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);
```

**Timezone Note:** UTC 8:00 AM = Lisbon 9:00 AM (winter) / 10:00 AM (summer with DST). Adjust schedule if needed.

### Step 4: Verify Jobs Are Scheduled

```sql
-- Check scheduled jobs
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```

Expected output:
```
          jobname          |  schedule   | active
---------------------------+-------------+--------
 check-past-due-services   | */15 * * * * | t
 daily-summary-notification| 0 8 * * *   | t
```

### Step 5: Test Immediate Execution

Manually trigger the check-past-due function to verify setup:

```sql
SELECT net.http_post(
  url := 'https://your-project.supabase.co/functions/v1/check-past-due',
  headers := '{"Authorization": "Bearer your-service-role-key", "Content-Type": "application/json"}'::jsonb,
  body := '{"triggered_at": "2026-01-30T12:00:00Z"}'::jsonb
);
```

Check response in pg_net logs:
```sql
SELECT id, created, request_id, status_code, content::text
FROM net._http_response
ORDER BY created DESC
LIMIT 5;
```

Successful execution returns status_code `200`.

## Monitoring

### Check Job Execution History

```sql
-- View recent job runs
SELECT jobname, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### Count Executions by Job

```sql
-- Count runs in last 24 hours
SELECT jobname, COUNT(*) as runs,
       SUM(CASE WHEN status = 'succeeded' THEN 1 ELSE 0 END) as successes,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures
FROM cron.job_run_details
WHERE start_time > now() - interval '24 hours'
GROUP BY jobname;
```

### Find Failed Runs

```sql
-- Show failed runs with error messages
SELECT jobname, return_message, start_time
FROM cron.job_run_details
WHERE status = 'failed'
ORDER BY start_time DESC
LIMIT 10;
```

### Check Notifications Created

```sql
-- View notifications created by scheduled jobs
SELECT user_id, type, title, message, created_at
FROM notifications
WHERE type IN ('past_due', 'daily_summary')
ORDER BY created_at DESC
LIMIT 20;
```

## Management Commands

### Disable a Job

```sql
-- Disable specific job
SELECT cron.unschedule('check-past-due-services');

-- Or update to inactive
UPDATE cron.job SET active = false WHERE jobname = 'check-past-due-services';
```

### Re-enable a Job

```sql
UPDATE cron.job SET active = true WHERE jobname = 'check-past-due-services';
```

### Change Schedule

```sql
-- Unschedule existing job
SELECT cron.unschedule('check-past-due-services');

-- Reschedule with new timing (e.g., every 30 minutes)
SELECT cron.schedule(
  'check-past-due-services',
  '*/30 * * * *',  -- New schedule
  $$ /* same SQL command as before */ $$
);
```

### Delete All Jobs

```sql
-- WARNING: This removes all scheduled jobs
SELECT cron.unschedule(jobname) FROM cron.job;
```

## Troubleshooting

### Job Not Running

1. **Check if job is active:**
   ```sql
   SELECT jobname, active FROM cron.job WHERE jobname = 'check-past-due-services';
   ```

2. **Check for errors in job history:**
   ```sql
   SELECT return_message FROM cron.job_run_details
   WHERE jobname = 'check-past-due-services'
   ORDER BY start_time DESC LIMIT 1;
   ```

3. **Verify vault secrets exist:**
   ```sql
   SELECT name FROM vault.decrypted_secrets;
   ```

### HTTP Request Fails (4xx/5xx status)

1. **Check edge function logs** in Supabase Dashboard → Edge Functions
2. **Verify service role key** is correct (Settings → API)
3. **Test edge function manually** using curl:
   ```bash
   curl -X POST https://your-project.supabase.co/functions/v1/check-past-due \
     -H "Authorization: Bearer your-service-role-key" \
     -H "Content-Type: application/json" \
     -d '{"triggered_at": "2026-01-30T12:00:00Z"}'
   ```

### No Notifications Created

1. **Check user preferences** - User may have disabled notifications:
   ```sql
   SELECT id, push_notifications_enabled, email_notifications_enabled,
          notification_preferences
   FROM profiles
   WHERE role = 'courier';
   ```

2. **Check quiet hours** - Notifications may be blocked by quiet hours:
   ```sql
   SELECT notification_preferences->'quietHours' as quiet_hours
   FROM profiles
   WHERE role = 'courier';
   ```

3. **Check working days** - Job may run on non-working day:
   ```sql
   SELECT working_days FROM profiles WHERE role = 'courier';
   ```

### Timezone Issues

Jobs run in **UTC timezone**. If notifications arrive at wrong time:

1. **Check courier's timezone setting:**
   ```sql
   SELECT timezone FROM profiles WHERE role = 'courier';
   ```

2. **Adjust cron schedule** to match desired local time:
   - For Lisbon (UTC+0 winter, UTC+1 summer):
     - Winter: 8:00 UTC = 8:00 Lisbon
     - Summer: 8:00 UTC = 9:00 Lisbon
   - To always deliver at 9:00 AM Lisbon winter time, use `0 9 * * *`

## Cron Schedule Syntax

| Field | Values | Description |
|-------|--------|-------------|
| Minute | 0-59 | Minute of the hour |
| Hour | 0-23 | Hour of the day (UTC) |
| Day of Month | 1-31 | Day of the month |
| Month | 1-12 | Month of the year |
| Day of Week | 0-6 | Day of week (0 = Sunday) |

**Examples:**
- `*/15 * * * *` - Every 15 minutes
- `0 8 * * *` - Daily at 8:00 AM
- `0 9 * * 1-5` - Weekdays at 9:00 AM
- `0 */2 * * *` - Every 2 hours

## Security Best Practices

1. **Rotate service role key** if exposed:
   - Generate new key in Settings → API
   - Update vault secret:
     ```sql
     SELECT vault.update_secret(
       (SELECT id FROM vault.secrets WHERE name = 'service_role_key'),
       'new-service-role-key'
     );
     ```

2. **Limit pg_cron permissions** - pg_cron runs as superuser, only allow trusted SQL

3. **Monitor job failures** - Set up alerts for failed jobs in production

4. **Use separate secrets per environment** - Don't share service role keys between staging/production

## Next Steps

After completing this setup:

1. ✅ Wait 15 minutes and check job execution history
2. ✅ Create an overdue service and verify courier gets notified
3. ✅ Wait until 8:00 AM UTC next day and check daily summary email
4. ✅ Monitor edge function logs for any errors
5. ✅ Set up alerts for failed cron jobs (optional)

## References

- [Supabase pg_cron Documentation](https://supabase.com/docs/guides/database/extensions/pg_cron)
- [Supabase Vault Documentation](https://supabase.com/docs/guides/database/vault)
- [pg_net Extension](https://github.com/supabase/pg_net)
- [Cron Expression Format](https://crontab.guru/)
