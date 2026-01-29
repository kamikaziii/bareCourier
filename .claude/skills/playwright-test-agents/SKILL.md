---
name: playwright-test-agents
description: Orchestrate Playwright Test Agents (Planner, Generator, Healer) for AI-powered E2E test automation. Use when creating test plans, generating tests from plans, or fixing failing tests.
---

# Playwright Test Agents

This skill orchestrates the three Playwright Test Agents for AI-powered end-to-end test automation.

## Overview

Playwright 1.56+ provides three specialized subagents that work together:

| Agent | Purpose | Color |
|-------|---------|-------|
| **🟢 Planner** | Explores app, creates Markdown test plans | Green |
| **🔵 Generator** | Converts plans into executable Playwright tests | Blue |
| **🔴 Healer** | Debugs and fixes failing tests automatically | Red |

## Project Structure

```
bareCourier/
├── .claude/agents/           # Agent definitions (auto-generated)
│   ├── playwright-test-planner.md
│   ├── playwright-test-generator.md
│   └── playwright-test-healer.md
├── specs/                    # Test plans (Markdown)
│   └── *.md
├── e2e/                      # Executable tests
│   ├── seed.spec.ts          # Seed file with fixtures
│   ├── fixtures.ts           # Login helpers, test data
│   └── *.spec.ts             # Test files
└── playwright.config.ts
```

## Quick Reference

### When to Use Each Agent

| Scenario | Agent | Command |
|----------|-------|---------|
| "Create a test plan for login flow" | Planner | Use planner agent |
| "Generate tests from specs/login.md" | Generator | Use generator agent |
| "Fix failing tests in e2e/" | Healer | Use healer agent |
| "Run tests and fix any failures" | Healer | Use healer agent |

---

## 🟢 Planner Agent

**Purpose**: Explores your application and creates comprehensive Markdown test plans.

### How to Invoke

```
Use the planner agent to create a test plan for [feature/flow]
```

### Workflow

1. **Setup**: Calls `planner_setup_page` to initialize browser
2. **Explore**: Uses `browser_snapshot` and navigation tools to discover UI
3. **Analyze**: Maps user flows, identifies interactive elements
4. **Design**: Creates scenarios (happy path, edge cases, errors)
5. **Save**: Calls `planner_save_plan` to write `specs/*.md`

### Test Plan Format

```markdown
# [Feature Name] Test Plan

## Overview
Brief description of what's being tested.

### 1. [Test Group Name]
**Seed:** `e2e/seed.spec.ts`

#### 1.1 [Scenario Name]
**Preconditions:** User is logged in as courier

**Steps:**
1. Navigate to /courier/services
2. Click "New Service" button
3. Fill in pickup location
4. Fill in delivery location
5. Click "Create" button

**Expected Results:**
- Service appears in list with "Pending" status
- Success toast message displayed

#### 1.2 [Another Scenario]
...
```

### Best Practices for Planner

- **Be specific**: "Create test plan for client service creation flow" not "test the app"
- **Scope appropriately**: One feature/flow per plan
- **Include auth context**: Specify which user role (courier/client)
- **Fresh state assumption**: Plans assume blank/fresh starting state

---

## 🔵 Generator Agent

**Purpose**: Transforms Markdown test plans into executable Playwright tests.

### How to Invoke

```
Use the generator agent to create tests from specs/[plan-name].md
```

Or for specific sections:

```
Use the generator agent to create tests for "Adding a Service" section from specs/services.md
```

### Workflow

1. **Read Plan**: Parses the Markdown test plan
2. **Setup**: Calls `generator_setup_page` for each scenario
3. **Execute**: Runs each step live with Playwright tools
4. **Verify**: Uses `browser_verify_*` tools for assertions
5. **Log**: Calls `generator_read_log` to get recorded actions
6. **Write**: Calls `generator_write_test` to save `.spec.ts` file

### Generated Test Format

```typescript
// spec: specs/services.md
// seed: e2e/seed.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Service Management', () => {
  test('Create new service', async ({ page }) => {
    // 1. Navigate to services page
    await page.goto('/en/courier/services');

    // 2. Click "New Service" button
    await page.getByRole('button', { name: 'New Service' }).click();

    // 3. Fill in pickup location
    await page.getByLabel('Pickup Location').fill('123 Main St');

    // ... more steps
  });
});
```

### Best Practices for Generator

- **One test per file**: Generator creates single-test files
- **Use semantic locators**: `getByRole`, `getByLabel`, `getByText`
- **Comment each step**: Include step text as comments
- **Reuse fixtures**: Import from `e2e/fixtures.ts` for auth helpers

---

## 🔴 Healer Agent

**Purpose**: Debugs failing tests and automatically fixes them.

### How to Invoke

```
Use the healer agent to fix failing tests
```

Or for specific tests:

```
Use the healer agent to fix e2e/03-client-management.spec.ts
```

### Workflow

1. **Run**: Calls `test_run` to execute all tests
2. **Identify**: Finds failing tests from output
3. **Debug**: Calls `test_debug` on each failing test
4. **Investigate**: Uses snapshots, console logs, network requests
5. **Analyze**: Determines root cause (selector, timing, assertion)
6. **Fix**: Edits test code with `Edit` tool
7. **Verify**: Reruns test to confirm fix
8. **Iterate**: Repeats until all tests pass or marks as `test.fixme()`

### Common Fixes

| Issue | Solution |
|-------|----------|
| Selector changed | Update to match current UI |
| Timing issue | Add proper waits (not `networkidle`) |
| Dynamic data | Use regex patterns in locators |
| Missing element | Add `waitForSelector` or check visibility |
| Assertion mismatch | Update expected values |

### Best Practices for Healer

- **Fix one at a time**: Address errors incrementally
- **No `networkidle`**: Discouraged/deprecated API
- **Document fixes**: Add comments explaining changes
- **Use `test.fixme()`**: For genuinely broken functionality, not test issues

---

## Seed File Configuration

The seed file (`e2e/seed.spec.ts`) contains setup logic copied into generated tests.

### Current Seed (Basic)

```typescript
import { test, expect } from '@playwright/test';

test.describe('Test group', () => {
  test('seed', async ({ page }) => {
    // generate code here.
  });
});
```

### Recommended Seed for bareCourier

```typescript
import { test, expect, loginAsCourier, loginAsClient } from './fixtures';

test.describe('bareCourier seed', () => {
  test('authenticated as courier', async ({ page }) => {
    await loginAsCourier(page);
  });

  test('authenticated as client', async ({ page }) => {
    await loginAsClient(page);
  });
});
```

---

## Complete Workflow Example

### 1. Plan (Planner Agent)

```
User: "Use the planner agent to create a test plan for the client
service request flow, including creating, viewing, and canceling services"

→ Creates: specs/client-service-flow.md
```

### 2. Generate (Generator Agent)

```
User: "Use the generator agent to create tests from specs/client-service-flow.md"

→ Creates: e2e/client-service-flow/*.spec.ts
```

### 3. Heal (Healer Agent)

```
User: "Use the healer agent to run and fix any failing tests"

→ Runs tests, fixes failures, verifies all pass
```

---

## Project-Specific Notes (bareCourier)

### Authentication

- **Courier**: `loginAsCourier(page)` from `e2e/fixtures.ts`
- **Client**: `loginAsClient(page)` from `e2e/fixtures.ts`
- Always dismiss PWA update prompt if present

### URL Patterns

- Base URL: `http://localhost:5173`
- Login: `/en/login`
- Courier routes: `/en/courier/*`
- Client routes: `/en/client/*`

### Existing Test Files

| File | Coverage |
|------|----------|
| `01-auth.spec.ts` | Login, logout, role redirects |
| `02-courier-setup.spec.ts` | Courier initial setup |
| `03-client-management.spec.ts` | Client CRUD |
| `04-courier-services.spec.ts` | Service management |
| `05-client-experience.spec.ts` | Client service flow |
| `06-request-negotiation.spec.ts` | Accept/reject/suggest |
| `07-calendar-billing.spec.ts` | Calendar and billing |
| `08-notifications.spec.ts` | Notification system |

### Test Configuration

- Sequential execution (`fullyParallel: false`, `workers: 1`)
- HTML reporter
- Screenshots on failure only
- Traces on first retry

---

## Troubleshooting

### "Agent not found"

Regenerate agent definitions:
```bash
npx playwright init-agents --loop=claude
```

### "MCP tools not available"

Check `.mcp.json` has the playwright-test server configured:
```json
{
  "mcpServers": {
    "playwright-test": {
      "command": "npx",
      "args": ["playwright", "run-test-mcp-server"]
    }
  }
}
```

### "Test keeps failing after fix"

1. Check if it's a real app bug (not test issue)
2. Use `test.fixme()` with explanation comment
3. Create a GitHub issue for the underlying bug

### "Planner explores wrong page"

Ensure seed file has correct `page.goto()` or specify starting URL in request.

---

## Updating Agents

When Playwright updates, regenerate agent definitions to get new tools:

```bash
npx playwright init-agents --loop=claude
```

This updates `.claude/agents/*.md` with latest capabilities.
