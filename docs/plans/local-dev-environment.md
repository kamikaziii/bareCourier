# Local Development Environment — Separate Dev from Production

## Problem

E2E tests (`e2e/00-reset.spec.ts`) delete all services, clients, notifications, and reset the courier profile. This runs against the **live production database**. Once real users exist, running tests will wipe their data.

## Current State

- Single Supabase project used for everything (dev, testing, production)
- `.env` points to production Supabase URL
- E2E tests use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS and delete data
- No environment separation whatsoever

## Recommended Approach: Local Dev + Staging Project

### 1. Local Development (`supabase start`)

For daily development and E2E tests on your machine.

```bash
supabase start    # Spins up local Postgres + Auth + Storage via Docker
supabase db reset # Replays all migrations + seed data
```

This gives you:
- Local Postgres at `localhost:54322`
- Local Auth at `localhost:54321`
- Local Studio at `localhost:54323`
- Local anon key + service role key (printed on start)

**What needs to change:**
- Create `.env.local` with local Supabase URLs and keys
- Create `supabase/seed.sql` with test data (courier account, etc.)
- E2E tests read from `.env.test` pointing to local instance
- `e2e/00-reset.spec.ts` runs `supabase db reset` or uses local service role key

### 2. Staging Project (Free Tier)

For CI/CD and pre-production testing.

- Create a second Supabase project (free tier allows 2 projects)
- Store staging project ref + keys in GitHub Secrets
- CI runs E2E tests against staging, never production

**GitHub Actions workflow:**
```yaml
on:
  push:
    branches: [develop]    # Deploy to staging
  pull_request:
    branches: [main]       # Test against staging

jobs:
  test:
    steps:
      - supabase link --project-ref $STAGING_PROJECT_ID
      - supabase db push
      - pnpm exec playwright test ...

  deploy-production:
    if: github.ref == 'refs/heads/main'
    steps:
      - supabase link --project-ref $PRODUCTION_PROJECT_ID
      - supabase db push
```

### 3. Production

- Only receives migrations via CI/CD on `main` merge
- Never touched by tests
- `.env.production` managed by Vercel dashboard

## Environment Files

| File | Purpose | Supabase Target |
|------|---------|-----------------|
| `.env.local` | Local dev (`pnpm run dev`) | `localhost:54321` |
| `.env.test` | E2E tests | `localhost:54321` |
| `.env.staging` | CI/CD testing | Staging project |
| `.env.production` | Vercel production | Production project |

## Implementation Steps

1. **Verify `supabase start` works** — Docker must be running, all migrations replay cleanly
2. **Create `supabase/seed.sql`** — courier account + test client, matching fixture credentials
3. **Create `.env.local`** with local Supabase URLs (from `supabase start` output)
4. **Create `.env.test`** for E2E pointing to local instance
5. **Update `e2e/00-reset.spec.ts`** to use local service role key
6. **Update `playwright.config.ts`** to load `.env.test`
7. **Test full E2E suite against local DB**
8. **Create staging Supabase project** (when ready for CI/CD)
9. **Add `.env.local` and `.env.test` to `.gitignore`**
10. **Remove production service role key from local `.env`**

## Edge Functions

Local `supabase start` also runs Edge Functions locally. The `send-email` function would need a mock or test mode to avoid sending real emails during E2E tests.

Options:
- Environment variable `SEND_EMAILS=false` to skip actual sending
- Use Resend test API key that doesn't deliver
- Mock the Edge Function response in tests

## Supabase Branching (Future)

Supabase offers PR-based preview environments (paid Pro plan add-on) where every PR gets its own ephemeral database. Worth considering when the team grows, but overkill for a solo project.

## References

- [Supabase: Managing Environments](https://supabase.com/docs/guides/deployment/managing-environments)
- [Supabase: Local Development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase: Branching](https://supabase.com/blog/supabase-branching)
