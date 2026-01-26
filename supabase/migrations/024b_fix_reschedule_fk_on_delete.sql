-- Fix foreign key to handle profile deletion gracefully
ALTER TABLE services
  DROP CONSTRAINT IF EXISTS services_last_rescheduled_by_fkey;

ALTER TABLE services
  ADD CONSTRAINT services_last_rescheduled_by_fkey
  FOREIGN KEY (last_rescheduled_by)
  REFERENCES profiles(id)
  ON DELETE SET NULL;
