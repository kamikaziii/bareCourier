# E2E Testing Guide (Playwright)

## Overview

Sequential workflow tests that simulate the full courier-client lifecycle against a live dev server with a real Supabase backend.

**Config**: `playwright.config.ts` — `fullyParallel: false`, `workers: 1`, Chromium only.

## Commands

```bash
# Run all phases (reset → onboarding → client → service)
pnpm exec playwright test e2e/00-reset.spec.ts e2e/01-courier-onboarding.spec.ts e2e/02-first-client-creation.spec.ts e2e/03-courier-creates-service.spec.ts

# Run a single phase
pnpm exec playwright test e2e/01-courier-onboarding.spec.ts

# Run a single test by name
pnpm exec playwright test e2e/ -g "3.2"

# See console.log output (Playwright suppresses it by default)
pnpm exec playwright test e2e/ --reporter=null

# View trace for debugging failures
pnpm exec playwright show-trace test-results/*/trace.zip
```

**Important**: Don't run `pnpm exec playwright test e2e/` without specifying files — archived tests in `e2e/archive/` cause import errors.

## Test Structure

| File | Phase | What it tests |
|------|-------|---------------|
| `00-reset.spec.ts` | Reset | Cleans DB: services, client profiles, auth users, service types, settings |
| `01-courier-onboarding.spec.ts` | 1: Onboarding | Account setup, pricing model, service types, distribution zones, VAT, scheduling, notifications |
| `02-first-client-creation.spec.ts` | 2: Client | Navigate to clients, create client (password flow), verify details, client login |
| `03-courier-creates-service.spec.ts` | 3: Service | Navigate to form, fill form with addresses, submit, verify in list and dashboard |

Tests are **ordered and dependent** — Phase 2 needs Phase 1 data, Phase 3 needs Phase 2 data.

## Key Files

- **`e2e/fixtures.ts`** — `loginAsCourier(page)`, `loginAsClient(page)`, credential constants
- **`e2e/seed.spec.ts`** — Supabase admin client setup (uses `SUPABASE_SERVICE_ROLE_KEY` from `.env`)
- **`specs/workflow-tests-plan.md`** — Original test plan with all phases

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Courier | `garridoinformaticasupport@gmail.com` | `6Ee281414` |
| Client | `test@example.com` | `6Ee281414` |

## Patterns

### Login / Session

```typescript
import { loginAsCourier, loginAsClient } from './fixtures';

// In beforeEach
await loginAsCourier(page);
await expect(page).toHaveURL(/\/en\/courier/);

// Switching users — clear session first
await page.context().clearCookies();
await page.evaluate(() => localStorage.clear());
await loginAsClient(page);
```

### Settings Tab Navigation

Svelte hydration race: tabs are SSR-rendered but event handlers aren't attached until hydration completes. Always wait for `networkidle` before clicking tabs.

```typescript
async function goToSettingsTab(page: Page, tabName: string) {
  await page.goto('/en/courier/settings');
  await page.waitForLoadState('networkidle');
  if (tabName !== 'Account') {
    await page.getByRole('tab', { name: tabName }).click();
  }
}
```

**Don't use URL params** (`?tab=pricing`) — they work inconsistently with SvelteKit client-side routing.

### Mapbox Address Autocomplete

```typescript
const input = page.getByRole('textbox', { name: /Delivery Location/i });
await input.fill('Avenida da Liberdade 1, Lisboa');

// Suggestions appear as buttons — wait with generous timeout (API call)
const suggestion = page.getByRole('button', { name: /Avenida da Liberdade/i }).first();
await expect(suggestion).toBeVisible({ timeout: 8000 });
await suggestion.click();

// Verify zone validation
await expect(page.getByText('In zone').last()).toBeVisible({ timeout: 5000 });
```

### Native `<select>` Elements

```typescript
// Use selectOption, not click-based selection
await page.getByRole('combobox', { name: /Client/i }).selectOption({ label: 'Test Business' });
```

### Sonner Toast Assertions

```typescript
// Any toast
const toast = page.locator('[data-sonner-toast]');
await expect(toast).toBeVisible({ timeout: 5000 });

// Error toast specifically
const errorToast = page.locator('[data-sonner-toast]').filter({ hasText: /failed|error/i });
```

### Idempotent Test Pattern

Check if data exists before creating to survive re-runs without a reset:

```typescript
const existing = page.getByText('Test Business');
if (await existing.isVisible({ timeout: 2000 }).catch(() => false)) {
  return; // Already exists, skip creation
}
// ... create the resource
```

### Price Text Selectors

`getByText('€5.00').first()` can match hidden `<option>` elements. Scope to a visible container:

```typescript
// Bad — matches hidden <option> in <select>
await expect(page.getByText('€5.00').first()).toBeVisible();

// Good — scoped to the Price Breakdown section
await expect(page.locator('text=Total').locator('..').getByText('€5.00')).toBeVisible();
```

## Gotchas

1. **PWA disabled in dev** — `vite.config.ts` has `devOptions.enabled: false`. No service worker prompt in dev/test. Don't re-enable it or tests will break.

2. **Svelte hydration timing** — SSR renders HTML before Svelte attaches event handlers. Always `waitForLoadState('networkidle')` after `page.goto()` before clicking interactive elements.

3. **Archive directory** — Old test files in `e2e/archive/` have broken imports. Always specify test files explicitly in the command, never just `e2e/`.

4. **Auth user cleanup** — The reset script must delete `auth.users` before `profiles` (foreign key). Orphaned auth users (email in auth but no profile) block client creation.

5. **Toast timing** — Sonner toasts auto-dismiss after 4s (success) or 8s (error). When creating multiple items sequentially, add `waitForTimeout(4500)` between creations so toasts don't overlap.

## Adding New Test Phases

1. Follow the naming convention: `e2e/NN-description.spec.ts`
2. Reference the spec: `// spec: specs/workflow-tests-plan.md`
3. Use `loginAsCourier` or `loginAsClient` from fixtures in `beforeEach`
4. Make tests idempotent (check-before-create pattern)
5. Add the new file explicitly to run commands (don't rely on glob matching `e2e/`)
