-- Add email tracking columns to notifications table
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS email_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS email_id text,
ADD COLUMN IF NOT EXISTS email_status text DEFAULT 'pending';

COMMENT ON COLUMN notifications.email_sent_at IS 'When the email was sent via Resend';
COMMENT ON COLUMN notifications.email_id IS 'Resend email ID for tracking';
COMMENT ON COLUMN notifications.email_status IS 'Email status: pending, sent, delivered, bounced, failed';
