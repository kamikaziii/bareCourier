# Form State Testing Guide

Test cases and strategies to catch form state sync issues before they ship.

## Manual Testing Checklist

### Scenario 1: Form Load and Display
```
Setup:
  1. Navigate to form page (e.g., /courier/profile/edit)
  2. Initial data loads from parent props

Tests:
  [ ] All form fields display correct initial values
  [ ] Values match what was passed in props
  [ ] No fields are empty or showing undefined
```

### Scenario 2: Submit and Verify Sync
```
Setup:
  1. Open form with initial data
  2. Edit at least one field with new value
  3. Submit the form

Tests:
  [ ] Form submission succeeds (no error message)
  [ ] Backend confirms update
  [ ] Form fields auto-update to show new values
  [ ] NO manual page refresh needed
  [ ] NO manual form state reset needed
```

### Scenario 3: Navigate Between Items
```
Setup:
  1. Form is displayed with item A's data
  2. User selects different item B from dropdown
  3. Form loads item B's data via props

Tests:
  [ ] Form fields automatically update to item B's values
  [ ] No stale data from item A visible
  [ ] All fields show correct values for item B
```

### Scenario 4: Error Recovery
```
Setup:
  1. Submit form with invalid data (if validation exists)
  2. Fix the error
  3. Submit again

Tests:
  [ ] Error message displays first time
  [ ] Error clears on successful submission
  [ ] Form shows updated data from successful submission
```

## E2E Testing Examples

### Test 1: Form Submission Flow

```typescript
// tests/form-submission.spec.ts
import { test, expect } from '@playwright/test';

test('form syncs with prop updates after submission', async ({ page }) => {
  // Navigate to form
  await page.goto('/courier/profile/edit');

  // Verify initial data loaded
  const emailInput = page.getByRole('textbox', { name: /email/i });
  const initialEmail = await emailInput.inputValue();
  expect(initialEmail).toBe('courier@example.com');

  // Edit form
  await emailInput.fill('newemail@example.com');
  await page.getByRole('button', { name: /save/i }).click();

  // Wait for submission to complete
  await page.waitForURL('/courier/profile/edit');
  await page.waitForTimeout(500); // Wait for data refresh

  // Verify form shows updated value
  const newEmail = await emailInput.inputValue();
  expect(newEmail).toBe('newemail@example.com');
});
```

### Test 2: Multi-Item Form Switching

```typescript
// tests/form-item-switching.spec.ts
import { test, expect } from '@playwright/test';

test('form updates when switching between items', async ({ page }) => {
  // Load page with item A selected
  await page.goto('/courier/services?id=service-1');

  const pickupInput = page.getByRole('textbox', { name: /pickup/i });
  const initialPickup = await pickupInput.inputValue();
  expect(initialPickup).toBe('123 Main St, Downtown');

  // Switch to item B via dropdown
  await page.getByRole('combobox', { name: /select service/i })
    .selectOption('service-2');

  // Wait for data to load
  await page.waitForTimeout(500);

  // Verify form shows item B's data
  const newPickup = await pickupInput.inputValue();
  expect(newPickup).toBe('456 Oak Ave, Midtown');
  expect(newPickup).not.toBe(initialPickup);
});
```

### Test 3: Catch $state Bug

This test will FAIL if form values use `$state` instead of `$derived`:

```typescript
// tests/form-state-sync-regression.spec.ts
import { test, expect } from '@playwright/test';

test('form values use $derived not $state (regression test)', async ({ page }) => {
  // Load form with initial data
  await page.goto('/client/new-request');

  const clientNameField = page.getByRole('textbox', { name: /client name/i });
  const initialName = await clientNameField.inputValue();

  // Edit the field
  const newName = initialName + ' Updated';
  await clientNameField.fill(newName);

  // Submit form
  await page.getByRole('button', { name: /submit/i }).click();

  // Simulate parent component updating props by reloading data
  // (In real app, parent would update props after successful submission)
  await page.reload();

  // CRITICAL: If form uses $state, field will show "newName"
  // If form uses $derived, field will show initial value from server
  const displayedName = await clientNameField.inputValue();

  // This test confirms the form is synced (using $derived)
  // If it fails, the component needs $derived instead of $state
  expect(displayedName).toBe(initialName);
});
```

## Visual Regression Testing

### Check for Visual Glitches

```typescript
test('form renders without layout shift after submission', async ({ page }) => {
  await page.goto('/courier/profile/edit');

  // Take screenshot before
  await page.screenshot({ path: 'form-before.png' });

  // Submit form
  await page.getByRole('button', { name: /save/i }).click();
  await page.waitForTimeout(1000);

  // Take screenshot after
  await page.screenshot({ path: 'form-after.png' });

  // Verify no layout shift or missing elements
  // (Use Playwright visual comparison if available)
});
```

## Checklist: Before Shipping Form Components

- [ ] **Manual Test**: Load form → verify all fields display correctly
- [ ] **Manual Test**: Edit field → submit → verify auto-update without reload
- [ ] **Manual Test**: Navigate to different item → form resets to new item data
- [ ] **E2E Test**: Submission flow test passes
- [ ] **E2E Test**: Multi-item switching test passes
- [ ] **Code Review**: No `let X = $state(props.Y)` patterns
- [ ] **Code Review**: Form values use `$derived` from props
- [ ] **Code Review**: UI state (loading, errors) uses `$state`
- [ ] **Browser Test**: Works on mobile viewport
- [ ] **Browser Test**: Works in different browsers (Chrome, Safari, Firefox)

## Common Test Failures & Fixes

| Failure | Likely Cause | Fix |
|---------|-------------|-----|
| Form doesn't update after submission | Form values use `$state(props.X)` | Change to `$derived(props.X)` |
| Form shows stale data | Missing auto-sync | Check for `$state` on prop values |
| Layout shifts on submit | Component unmounting/remounting | Use `$derived` not {#key} |
| Fields are empty/undefined | Null/undefined handling | Add ?? '' in $derived |

## Integration with CI/CD

```yaml
# .github/workflows/e2e-tests.yml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - uses: pnpm/action-setup@v2
    - uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'pnpm'
    - run: pnpm install
    - run: pnpm run build
    - run: pnpm exec playwright install
    - run: pnpm exec playwright test
```

## Quick Test Script

Run this before committing form changes:

```bash
#!/bin/bash
# test-forms.sh

echo "Building project..."
pnpm run build || exit 1

echo "Running E2E tests..."
pnpm exec playwright test --grep "form" || exit 1

echo "All form tests passed!"
```

## Resources

- Full guide: [svelte-form-state.md](../rules/svelte-form-state.md)
- Review checklist: [form-state-review.md](../checklists/form-state-review.md)
- Prevention guide: [svelte-form-state-sync.md](../prevention/svelte-form-state-sync.md)
