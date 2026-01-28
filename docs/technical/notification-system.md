# Notification System

## Overview

bareCourier has an automated notification system that alerts the courier and clients about overdue services and provides daily summaries. It runs on Supabase infrastructure using **pg_cron** (scheduler), **pg_net** (HTTP calls), **Vault** (secret storage), and **Edge Functions** (logic).

## Architecture

```
pg_cron (scheduler)
  │
  ├─ every 15 min ──► Edge Function: check-past-due
  │                        │
  │                        ├─ Reads courier settings (grace periods, reminder interval, quiet hours, working days)
  │                        ├─ Finds overdue services
  │                        └─ Sends notifications (in-app, push, email) based on preferences
  │
  └─ daily at 8:00 UTC ──► Edge Function: daily-summary
                               │
                               ├─ Reads courier settings (timezone, working days, daily summary enabled/time)
                               ├─ Gathers today's pending, delivered, and urgent services
                               └─ Sends summary notification based on preferences
```

## Components

### 1. Database Extensions

| Extension | Purpose |
|-----------|---------|
| `pg_cron` | Schedules SQL jobs on a cron expression |
| `pg_net` | Makes HTTP requests from within Postgres |
| `supabase_vault` | Stores secrets (project URL, service role key) encrypted at rest |

### 2. Vault Secrets

| Secret Name | Value | Used For |
|-------------|-------|----------|
| `project_url` | `https://<project>.supabase.co` | Building Edge Function URLs |
| `service_role_key` | Service role JWT | Authenticating cron → Edge Function calls (bypasses RLS) |

### 3. Cron Jobs

| Job | Schedule | Edge Function |
|-----|----------|---------------|
| `check-past-due-services` | `*/15 * * * *` (every 15 min) | `/functions/v1/check-past-due` |
| `daily-summary-notification` | `0 8 * * *` (daily at 8:00 UTC) | `/functions/v1/daily-summary` |

The cron jobs run on a fixed schedule. The Edge Functions decide whether to actually send notifications based on courier settings.

### 4. Edge Functions

**`check-past-due`** — Finds services past their scheduled time + grace period. Deduplicates using `last_past_due_notification_at` on each service row and the courier's `pastDueReminderInterval` setting.

**`daily-summary`** — Compiles a summary of the day's services (pending, delivered, urgent). Only sends if the courier has daily summaries enabled and it's a working day.

Both functions use the shared `_shared/notify.ts` module which handles multi-channel dispatch (in-app, push, email) and respects quiet hours and working day settings.

## Courier Settings

All behavior is configured from **Courier Settings** (`/courier/settings`):

### Notifications Tab

- **Channels**: Toggle push and email globally (in-app is always on)
- **Category preferences**: Per-category (past due, daily summary, new request, schedule change, service status) toggle for each channel
- **Quiet hours**: Time window where push/email are suppressed (e.g. 21:00–08:00)
- **Working days only**: Suppress notifications on non-working days
- **Past due reminder interval**: How often to re-notify about overdue services (0 = disabled, 15/30/60/120 min)
- **Daily summary**: Enable/disable + preferred time (HH:MM)
- **Timezone**: Used for all time calculations

### Scheduling Tab

- **Time slots**: Morning, afternoon, evening windows (e.g. 08:00–12:00)
- **Working days**: Which days of the week are active
- **Grace periods**: Minutes after a time slot ends before a service is considered past due
- **Urgency thresholds**: When to flag services as approaching/urgent/critical

### How Settings Affect Cron Behavior

The cron jobs always fire on schedule. The Edge Functions then check:

1. Is today a working day? → If not and `workingDaysOnly` is on, skip.
2. Is it quiet hours? → If yes, skip push/email (in-app still created).
3. Is the feature enabled? → e.g. `dailySummaryEnabled`, `pastDueReminderInterval > 0`.
4. Has enough time passed since last notification? → Deduplication via timestamps.
5. Which channels are enabled for this category? → Send only to enabled channels.

## Database Storage

Settings are stored as JSONB fields on the courier's `profiles` row:

| Field | Type | Contains |
|-------|------|----------|
| `past_due_settings` | jsonb | Grace periods, thresholds, reminder interval, daily summary config |
| `notification_preferences` | jsonb | Per-category channel toggles, quiet hours, working days only |
| `time_slots` | jsonb | Morning/afternoon/evening time windows |
| `working_days` | text[] | Active days of the week |
| `timezone` | text | e.g. `Europe/Lisbon` |

Services track notification state via:

| Field | Table | Purpose |
|-------|-------|---------|
| `last_past_due_notification_at` | `services` | Prevents duplicate past-due reminders |

## Setup

The extensions, vault secrets, and cron jobs were set up via Supabase MCP. If they ever need to be recreated:

1. **Enable extensions** (migration or SQL editor):
   ```sql
   CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
   CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
   ```

2. **Create vault secrets** (SQL editor — requires service role key from Dashboard > Settings > API):
   ```sql
   SELECT vault.create_secret('<PROJECT_URL>', 'project_url');
   SELECT vault.create_secret('<SERVICE_ROLE_KEY>', 'service_role_key');
   ```

3. **Schedule cron jobs**:
   ```sql
   SELECT cron.schedule(
     'check-past-due-services', '*/15 * * * *',
     $$ SELECT net.http_post(
       url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/check-past-due',
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
       body := jsonb_build_object('triggered_at', now())
     ) AS request_id; $$
   );

   SELECT cron.schedule(
     'daily-summary-notification', '0 8 * * *',
     $$ SELECT net.http_post(
       url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/daily-summary',
       headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'service_role_key')),
       body := jsonb_build_object('triggered_at', now())
     ) AS request_id; $$
   );
   ```

4. **Verify** cron jobs are registered and running:
   ```sql
   SELECT jobname, schedule, active FROM cron.job;
   SELECT jobid, status, return_message, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
   ```

## Troubleshooting

- **Cron jobs not running**: Check `cron.job` table for `active = true`. Check `cron.job_run_details` for errors.
- **Edge Function errors**: Check Supabase Dashboard > Edge Functions > Logs, or use `mcp__supabase__get_logs(service: "edge-function")`.
- **No notifications sent**: Verify courier has the category enabled in notification preferences, is within working hours, and not in quiet hours.
- **Duplicate notifications**: Check `last_past_due_notification_at` on the service and the `pastDueReminderInterval` setting.
