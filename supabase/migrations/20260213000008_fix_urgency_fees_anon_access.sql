DROP POLICY IF EXISTS "urgency_fees_select_all" ON urgency_fees;

CREATE POLICY "urgency_fees_select_authenticated" ON urgency_fees
  FOR SELECT TO authenticated
  USING (true);
