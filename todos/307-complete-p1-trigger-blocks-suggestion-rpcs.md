---
status: complete
priority: p1
issue_id: "307"
tags: [bug, critical, rls, supabase, services, trigger, regression]
dependencies: []
---

# REGRESSION: Trigger Blocks client_approve/deny_reschedule RPCs

## Problem Statement

Migration `20260213000001` (fix trigger restore pending edit) inadvertently moved `scheduled_date`, `scheduled_time_slot`, `suggested_date`, and `suggested_time_slot` into the "always blocked" section of the trigger — BEFORE the suggestion bypass at line 78. This makes the suggestion bypass dead code and **breaks both `client_approve_reschedule()` and `client_deny_reschedule()` RPCs**.

The previous migration `20260207000001` had correctly placed these fields AFTER the suggestion bypass. The fix in `20260213000001` was only meant to restore the pending-service clause but accidentally regressed the field ordering.

**This is a functional bug — the client suggestion acceptance/denial flow is completely broken.**

## Findings

- **Root cause:** Migration `20260213000001` placed scheduling field checks (lines 54-68) BEFORE the suggestion bypass (line 78), whereas `20260207000001` had them AFTER the bypass (lines 74-88, after bypass at line 69)
- **False claim by original audit agents:** The agents stated "SECURITY DEFINER RPCs bypass this trigger" — this is **FALSE**. PostgreSQL triggers ALWAYS fire regardless of SECURITY DEFINER. And `auth.uid()` in the trigger resolves from the JWT session variables, not the function's security context. So the trigger sees the client role and applies restrictions.
- **How `client_approve_reschedule` fails:**
  1. RPC does `UPDATE services SET scheduled_date = suggested_date, suggested_date = NULL, request_status = 'accepted'`
  2. Trigger fires. `auth.uid()` = client's UUID from JWT. Role = 'client'.
  3. Line 54: `NEW.scheduled_date IS DISTINCT FROM OLD.scheduled_date` → TRUE → RAISE EXCEPTION
  4. **Never reaches** the suggestion bypass at line 78
- **How `client_deny_reschedule` fails:**
  1. RPC does `UPDATE services SET suggested_date = NULL, suggested_time_slot = NULL, request_status = 'accepted'`
  2. Trigger fires. Role = 'client'.
  3. Line 62: `NEW.suggested_date (NULL) IS DISTINCT FROM OLD.suggested_date` → TRUE → RAISE EXCEPTION
  4. **Never reaches** the suggestion bypass at line 78

### Trigger evolution proving the regression:

**20260207000001 (WORKING — correct field order):**
```
"Always blocked": client_id, status, delivered_at, calculated_price, price_breakdown, urgency_fee_id, notes
↓
SUGGESTION BYPASS (line 69) → RETURN NEW  ← reaches here
↓
Scheduling fields blocked (lines 74-88): scheduled_date, scheduled_time_slot, suggested_date, suggested_time_slot
↓
Location fields blocked (lines 91-111)
```

**20260213000001 (CURRENT — BROKEN field order):**
```
"Always blocked" (lines 33-68): client_id, status, delivered_at, calculated_price, price_breakdown,
  scheduled_date, scheduled_time_slot, suggested_date, suggested_time_slot  ← BLOCKS RPCs HERE
↓
Pending check (line 72) → RETURN NEW
↓
SUGGESTION BYPASS (line 78) → RETURN NEW  ← DEAD CODE (never reached)
↓
Location/notes/distance fields blocked (lines 83-111)
```

**Affected file:** `supabase/migrations/20260213000001_fix_trigger_restore_pending_edit.sql`

## Proposed Solutions

### Option 1: Restore Correct Field Ordering (Recommended)

**Approach:** Move `scheduled_date`, `scheduled_time_slot`, `suggested_date`, `suggested_time_slot` from the "always blocked" section to AFTER the suggestion bypass, matching the order in `20260207000001`, while keeping the pending check from `20260213000001`.

Correct order:
1. "Never modify" fields: client_id, status, delivered_at, calculated_price, price_breakdown
2. Pending check → RETURN NEW
3. Suggestion bypass (suggested → accepted) → RETURN NEW
4. Scheduling fields blocked: scheduled_date, scheduled_time_slot, suggested_date, suggested_time_slot
5. Location/notes/distance/urgency fields blocked

**Pros:**
- Restores suggestion acceptance/denial flow
- Maintains pending-service editing
- Matches the proven working order from 20260207000001
- Minimal change — just reorder the field checks

**Cons:**
- Must test all three flows: pending editing, suggestion acceptance, suggestion denial

**Effort:** 30 minutes

**Risk:** Low — restoring a previously working order

---

### Option 2: Add RPC Guard Variable (Alternative)

**Approach:** Set a session variable inside the RPCs before the UPDATE, and check it in the trigger to skip checks.

```sql
-- In client_approve_reschedule:
PERFORM set_config('app.rpc_bypass', 'true', true);
UPDATE public.services SET ...;

-- In trigger:
IF current_setting('app.rpc_bypass', true) = 'true' THEN
  RETURN NEW;
END IF;
```

**Pros:**
- RPCs explicitly bypass trigger
- No field reordering needed

**Cons:**
- Adds hidden state coupling between RPCs and trigger
- If any RPC forgets to set the variable, it silently fails
- More complex, harder to audit

**Effort:** 1 hour

**Risk:** Medium — session variable approach is fragile

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `supabase/migrations/20260213000001_fix_trigger_restore_pending_edit.sql` — trigger with wrong field order
- New migration required to fix field ordering

**Related RPCs (BROKEN by this bug):**
- `client_approve_reschedule()` (20260205000002) — sets scheduled_date, clears suggested fields
- `client_deny_reschedule()` (20260205000002) — clears suggested fields

**Database changes:**
- Migration needed: Yes
- Updated trigger function: `check_client_service_update_fields()`
- No schema changes — only reorder checks within the trigger

## Resources

- **Source:** Verification pass of RLS Security Audit todos — discovered that original finding was based on a false premise (SECURITY DEFINER does NOT bypass triggers)
- **Regression introduced by:** Migration `20260213000001` (this session's pending-edit fix)
- **Previously working in:** Migration `20260207000001`

## Acceptance Criteria

- [ ] `client_approve_reschedule()` successfully transitions request_status from 'suggested' to 'accepted' and applies suggested schedule
- [ ] `client_deny_reschedule()` successfully clears suggested fields and reverts to 'accepted' status
- [ ] Pending services can still be edited by clients (locations, notes, coordinates, etc.)
- [ ] Non-pending, non-suggested services still block scheduling field modifications by clients
- [ ] "Never modify" fields (client_id, status, delivered_at, calculated_price, price_breakdown) remain blocked in all states
- [ ] E2E test `06-request-negotiation.spec.ts` passes (if it covers suggestion flow)
- [ ] Migration applied with `supabase db push`

## Work Log

### 2026-02-13 - Initial Discovery (INCORRECT)

**By:** RLS Security Audit - 4-agent parallel review

**Actions:**
- Originally identified as "suggestion bypass too broad" (P2 security concern)
- Claimed SECURITY DEFINER RPCs bypass the trigger — this is FALSE

### 2026-02-13 - Corrected During Verification

**By:** Manual verification against migration source code

**Actions:**
- Discovered the original finding was based on a false premise about SECURITY DEFINER
- Traced trigger evolution across migrations 000036 → 20260207000001 → 20260213000001
- Confirmed that 20260207000001 had the correct field ordering (scheduling fields AFTER bypass)
- Confirmed that 20260213000001 regressed by moving scheduling fields BEFORE the bypass
- Escalated from P2 (security) to P1 (functional regression — broken feature)
- Renamed from "suggestion-bypass-too-broad" to "trigger-blocks-suggestion-rpcs"

**Learnings:**
- SECURITY DEFINER does NOT bypass PostgreSQL triggers — triggers always fire on the table
- auth.uid() in triggers reads JWT session variables, unaffected by SECURITY DEFINER context
- When restoring a clause in a trigger, the field ordering matters — not just the presence of the clause
- Always compare the full structure of the previous working version, not just the missing clause
