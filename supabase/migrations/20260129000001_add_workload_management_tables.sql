-- Workload Management System Tables
-- Part of: 2026-01-28-workload-management-design.md

-- Break logs: tracks all breaks (auto lunch, manual toggle, retroactive)
CREATE TABLE break_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  type TEXT NOT NULL CHECK (type IN ('lunch', 'manual', 'retroactive')),
  source TEXT NOT NULL CHECK (source IN ('auto', 'toggle', 'anomaly_prompt', 'daily_review')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for querying breaks by courier and date
CREATE INDEX idx_break_logs_courier_date ON break_logs (courier_id, started_at);

-- Delivery time logs: tracks actual delivery times for learning
CREATE TABLE delivery_time_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL,
  driving_time_minutes INTEGER,
  break_time_minutes INTEGER DEFAULT 0,
  delay_reason TEXT CHECK (delay_reason IN ('break', 'traffic', 'customer', 'other')),
  calculated_service_time_minutes INTEGER,
  include_in_learning BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for learning queries
CREATE INDEX idx_delivery_time_logs_courier_learning ON delivery_time_logs (courier_id, include_in_learning, created_at DESC);

-- Daily reviews: tracks end-of-day review completion
CREATE TABLE daily_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  review_date DATE NOT NULL,
  completed_at TIMESTAMPTZ,
  total_services INTEGER,
  total_work_minutes INTEGER,
  gaps_detected INTEGER,
  gaps_resolved INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(courier_id, review_date)
);

-- RLS Policies
ALTER TABLE break_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_time_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reviews ENABLE ROW LEVEL SECURITY;

-- Break logs: only couriers can manage their own breaks
-- Uses is_courier() to verify role, preventing clients from inserting with their own ID
CREATE POLICY break_logs_courier_all ON break_logs
  FOR ALL TO authenticated
  USING (public.is_courier() AND courier_id = (SELECT auth.uid()));

-- Delivery time logs: only couriers can manage their own logs
CREATE POLICY delivery_time_logs_courier_all ON delivery_time_logs
  FOR ALL TO authenticated
  USING (public.is_courier() AND courier_id = (SELECT auth.uid()));

-- Daily reviews: only couriers can manage their own reviews
CREATE POLICY daily_reviews_courier_all ON daily_reviews
  FOR ALL TO authenticated
  USING (public.is_courier() AND courier_id = (SELECT auth.uid()));

-- Index for service lookups in delivery_time_logs
CREATE INDEX idx_delivery_time_logs_service ON delivery_time_logs (service_id);
