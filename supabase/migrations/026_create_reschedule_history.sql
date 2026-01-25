-- Track reschedule requests and approvals
CREATE TABLE IF NOT EXISTS service_reschedule_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES services(id) ON DELETE CASCADE NOT NULL,
  initiated_by uuid REFERENCES profiles(id) NOT NULL,
  initiated_by_role text NOT NULL CHECK (initiated_by_role IN ('courier', 'client')),
  old_date date,
  old_time_slot text,
  old_time text,
  new_date date NOT NULL,
  new_time_slot text NOT NULL,
  new_time text,
  reason text,
  approval_status text DEFAULT 'auto_approved'
    CHECK (approval_status IN ('auto_approved', 'pending', 'approved', 'denied')),
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  denial_reason text,
  created_at timestamptz DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_reschedule_history_service ON service_reschedule_history(service_id);
CREATE INDEX idx_reschedule_history_pending ON service_reschedule_history(approval_status)
  WHERE approval_status = 'pending';

-- Enable RLS
ALTER TABLE service_reschedule_history ENABLE ROW LEVEL SECURITY;

-- Courier can see all, client can see their own services' history
CREATE POLICY reschedule_history_select ON service_reschedule_history
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'courier')
    OR EXISTS (
      SELECT 1 FROM services s
      WHERE s.id = service_reschedule_history.service_id
      AND s.client_id = (SELECT auth.uid())
    )
  );

-- Anyone can insert their own reschedule requests
CREATE POLICY reschedule_history_insert ON service_reschedule_history
  FOR INSERT WITH CHECK (initiated_by = (SELECT auth.uid()));

-- Only courier can update (for approval/denial)
CREATE POLICY reschedule_history_update ON service_reschedule_history
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'courier')
  );
