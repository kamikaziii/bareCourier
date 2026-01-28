# Phase 1 Implementation Issues to Fix

**Created**: 2025-01-21
**Status**: ✅ All fixes applied (2025-01-21)

---

## CRITICAL ISSUES

### 1. RLS Policy: services_update Allows Updating Soft-Deleted Services

**File**: Database RLS policy
**Problem**: The `services_update` policy only checks `is_courier()` but doesn't verify `deleted_at IS NULL`. A courier who knows the UUID of a soft-deleted service can still update it.

**Current Policy**:
```sql
services_update: USING (is_courier())
```

**Fix - Create migration `013_fix_phase1_security_issues.sql`**:
```sql
DROP POLICY IF EXISTS services_update ON services;
CREATE POLICY services_update ON services
    FOR UPDATE USING (
        is_courier() AND deleted_at IS NULL
    );
```

---

### 2. No Input Validation for Status Values

**File**: `src/routes/courier/services/[id]/+page.server.ts` lines 37-39

**Current Code**:
```typescript
const newStatus = formData.get('status') as 'pending' | 'delivered';
```

**Problem**: No validation - malicious user could send any value. Database CHECK constraint rejects it but error isn't user-friendly.

**Fix**:
```typescript
const newStatus = formData.get('status');
if (newStatus !== 'pending' && newStatus !== 'delivered') {
    return { success: false, error: 'Invalid status value' };
}
```

---

### 3. notifications_insert RLS Policy Too Permissive

**File**: Database RLS policy
**Problem**: Policy is `WITH CHECK (true)` - ANY authenticated user can insert notifications directly, enabling spam attacks.

**Current Policy**:
```sql
notifications_insert: WITH CHECK (true)
```

**Fix - Add to migration `013_fix_phase1_security_issues.sql`**:
```sql
-- Remove the permissive policy - triggers use SECURITY DEFINER so they still work
DROP POLICY IF EXISTS notifications_insert ON notifications;
```

---

## HIGH PRIORITY

### 4. Actions Don't Verify User Role (Defense-in-Depth)

**Files**:
- `src/routes/courier/services/[id]/+page.server.ts` - updateStatus, deleteService actions
- `src/routes/courier/services/[id]/edit/+page.server.ts` - default action
- `src/routes/courier/clients/[id]/+page.server.ts` - toggleActive action
- `src/routes/courier/clients/[id]/edit/+page.server.ts` - default action

**Problem**: All actions rely 100% on RLS without application-level role verification.

**Fix Pattern** (apply to each action):
```typescript
export const actions: Actions = {
    updateStatus: async ({ params, request, locals: { supabase, safeGetSession } }) => {
        const { session, user } = await safeGetSession();
        if (!session || !user) {
            return { success: false, error: 'Not authenticated' };
        }

        // Verify user is courier
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (profile?.role !== 'courier') {
            return { success: false, error: 'Unauthorized' };
        }

        // ... rest of existing action code
    }
};
```

---

## MEDIUM PRIORITY

### 5. No Error Feedback When Actions Fail

**Files**:
- `src/routes/courier/services/[id]/+page.svelte` - handleStatusChange(), handleDelete()
- `src/routes/courier/clients/[id]/+page.svelte` - handleToggleActive()

**Problem**: If actions fail, dialogs close with no error message to user.

**Current Code** (services/[id]/+page.svelte lines 50-66):
```typescript
async function handleStatusChange() {
    loading = true;
    const formData = new FormData();
    formData.set('status', pendingStatus);

    const response = await fetch(`?/updateStatus`, {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        await invalidateAll();
    }
    // BUG: If NOT ok, no error shown!
    loading = false;
    showStatusDialog = false;
}
```

**Fix**:
```typescript
let actionError = $state('');

async function handleStatusChange() {
    loading = true;
    actionError = '';
    const formData = new FormData();
    formData.set('status', pendingStatus);

    const response = await fetch(`?/updateStatus`, {
        method: 'POST',
        body: formData
    });

    if (response.ok) {
        await invalidateAll();
        showStatusDialog = false;
    } else {
        try {
            const result = await response.json();
            actionError = result.error || 'Failed to update status';
        } catch {
            actionError = 'An unexpected error occurred';
        }
    }
    loading = false;
}
```

Then display `actionError` in the dialog or as a toast.

---

### 6. update_updated_at_column Has INVOKER Security

**File**: Database function
**Problem**: Function should be DEFINER for consistent behavior.

**Fix - Add to migration `013_fix_phase1_security_issues.sql`**:
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';
```

---

## LOW PRIORITY

### 7. TypeScript Types Don't Enforce Database Constraints

**File**: `src/lib/database.types.ts`

**Problem**:
- `notifications.type` is union type in TS but just `text` in DB (no CHECK constraint)
- `service_status_history.old_status/new_status` are `text` not constrained to 'pending' | 'delivered'

**Optional Fix**: Add CHECK constraints to database:
```sql
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('service_status', 'new_request', 'schedule_change', 'service_created'));
```

---

## COMPLETE MIGRATION FILE

Create `supabase/migrations/013_fix_phase1_security_issues.sql`:

```sql
-- Fix Phase 1 Security Issues
-- 2025-01-21

-- 1. Fix services_update to check deleted_at
DROP POLICY IF EXISTS services_update ON services;
CREATE POLICY services_update ON services
    FOR UPDATE USING (
        is_courier() AND deleted_at IS NULL
    );

-- 2. Remove overly permissive notifications_insert policy
-- Triggers use SECURITY DEFINER so they still work
DROP POLICY IF EXISTS notifications_insert ON notifications;

-- 3. Fix update_updated_at_column security
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = '';

-- 4. Optional: Add type constraint to notifications
ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('service_status', 'new_request', 'schedule_change', 'service_created'));
```

---

## FILES TO MODIFY

1. **Database**: Apply migration `013_fix_phase1_security_issues.sql` via MCP

2. **`src/routes/courier/services/[id]/+page.server.ts`**:
   - Add input validation for status (line ~39)
   - Add role verification to updateStatus action
   - Add role verification to deleteService action

3. **`src/routes/courier/services/[id]/edit/+page.server.ts`**:
   - Add role verification to default action

4. **`src/routes/courier/clients/[id]/+page.server.ts`**:
   - Add role verification to toggleActive action

5. **`src/routes/courier/clients/[id]/edit/+page.server.ts`**:
   - Add role verification to default action

6. **`src/routes/courier/services/[id]/+page.svelte`**:
   - Add error state variable
   - Update handleStatusChange() to show errors
   - Update handleDelete() to show errors

7. **`src/routes/courier/clients/[id]/+page.svelte`**:
   - Add error state variable
   - Update handleToggleActive() to show errors

---

## VERIFICATION CHECKLIST

After fixes, verify:
- [ ] Cannot update soft-deleted services (test with direct API call)
- [ ] Invalid status values rejected with user-friendly error
- [ ] Cannot insert notifications directly (only via triggers)
- [ ] Non-courier users cannot perform courier actions
- [ ] Failed actions show error messages to user
- [ ] All TypeScript checks pass: `pnpm run check`
- [ ] Security advisors clean: `supabase inspect db lint`
