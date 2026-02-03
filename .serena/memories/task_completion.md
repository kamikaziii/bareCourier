# bareCourier - Task Completion Checklist

## Before Marking a Task Complete

### 1. Type Check
```bash
pnpm run check
```
Must pass with no errors.

### 2. Code Style Verification
- [ ] Using Svelte 5 runes (not legacy syntax)
- [ ] Props destructured with `$props()`
- [ ] Event handlers use `onclick` (not `on:click`)
- [ ] shadcn imports use `.js` extension
- [ ] TypeScript types are correct

### 3. Svelte-Specific Checks
- [ ] No `$state(prop)` without sync strategy (use `$derived` for prop values)
- [ ] No array/object mutations on `$derived` values
- [ ] Forms use `$effect` sync or `{#key}` for prop updates

### 4. Security Checks (for database changes)
- [ ] RLS policies updated if needed
- [ ] No sensitive data exposure
- [ ] Run `supabase inspect db lint` for migrations

### 5. Test the Change
- [ ] Manual testing in dev server
- [ ] Run relevant E2E tests if they exist
- [ ] Test both courier and client roles if applicable

### 6. Documentation
- [ ] Update types in `src/lib/database.types.ts` if schema changed
- [ ] Update CLAUDE.md if significant patterns added

## Do NOT
- Commit without running `pnpm run check`
- Leave TODO comments without creating a todo file
- Mix Svelte 4 and Svelte 5 syntax
- Use `git push --force` without explicit permission
