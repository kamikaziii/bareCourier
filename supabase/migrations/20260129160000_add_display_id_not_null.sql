-- Migration: Enforce NOT NULL constraint on display_id
-- Safe to apply because:
-- 1. Backfill script already populated all existing rows
-- 2. BEFORE INSERT trigger ensures new rows always get a value

ALTER TABLE services ALTER COLUMN display_id SET NOT NULL;
