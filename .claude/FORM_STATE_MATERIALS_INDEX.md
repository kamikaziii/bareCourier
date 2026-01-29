# Form State Management Prevention Materials - Index

**Created**: 2026-01-29
**Problem**: Form inputs losing values after submission due to `$state` initialization from props
**Solution**: Use `$derived` for prop-based form values

---

## Quick Navigation

### For Quick Reference (2-5 minutes)
- **Start Here**: `/FORM_STATE_QUICK_START.md` - Copy & paste template, decision tree
- **Summary**: `prevention/svelte-form-state-sync.md` - One-page overview

### For Code Review (5 minutes)
- **Review Checklist**: `checklists/form-state-review.md` - What to look for
- **Code Style**: `rules/code-style.md` - Updated with form section

### For Learning & Implementation (20-30 minutes)
- **Complete Guide**: `rules/svelte-form-state.md` - All patterns, examples, testing
- **Testing Guide**: `testing/form-state-testing.md` - Manual & E2E tests

### For Project Overview (10 minutes)
- **Prevention Strategy**: `PREVENTION_STRATEGY.md` - Full context, roadmap, implementation phases

---

## Document Descriptions

### 1. FORM_STATE_QUICK_START.md (5 min read)
**File**: `/FORM_STATE_QUICK_START.md`
**Length**: ~200 lines
**Best For**: Developers writing form components

**Contains**:
- 2-minute fix (before/after code)
- Copy & paste template ready to use
- Decision tree (bookmark this!)
- Code review red flags
- Quick 1-minute test checklist
- Common Q&A

**When to Use**: Starting a new form or fixing an existing one


### 2. PREVENTION_STRATEGY.md (10 min read)
**File**: `/PREVENTION_STRATEGY.md`
**Length**: ~350 lines
**Best For**: Project managers, team leads, understanding impact

**Contains**:
- Executive summary
- Detailed problem explanation
- Root cause analysis
- Why it happens (developer perspective)
- Real-world impact
- Complete solution explanation
- Implementation roadmap (4 phases)
- Impact metrics
- Next steps

**When to Use**: Understanding the big picture, planning team rollout


### 3. rules/svelte-form-state.md (30 min read)
**File**: `rules/svelte-form-state.md`
**Length**: ~540 lines
**Best For**: Comprehensive learning, different form patterns

**Contains**:
- Complete problem explanation with examples
- Four different form patterns:
  1. Simple form (few fields)
  2. Complex form (many fields)
  3. Radio buttons
  4. Form with validation
- `$state` vs `$derived` decision tree
- When to use {#key} blocks (and when NOT to)
- Code review checklist
- Testing strategy
- E2E test examples
- Quick reference table

**When to Use**: Learning all the patterns, understanding edge cases


### 4. checklists/form-state-review.md (5 min reference)
**File**: `checklists/form-state-review.md`
**Length**: ~110 lines
**Best For**: Code reviewers

**Contains**:
- Pre-review setup steps
- State declaration review process (decision tree format)
- Common anti-patterns to spot
- Edge cases
- Post-submission verification steps
- Testing recommendations
- Quick questions for reviewers

**When to Use**: During code review of form components


### 5. prevention/svelte-form-state-sync.md (2 min reference)
**File**: `prevention/svelte-form-state-sync.md`
**Length**: ~100 lines
**Best For**: Quick reference, pinned on wall/slack

**Contains**:
- The one rule to remember
- Quick reference format
- Pattern template
- Test after submission
- Code review red flags
- Why it matters (cost/impact)

**When to Use**: Quick lookup, bookmarked reference


### 6. testing/form-state-testing.md (20 min read)
**File**: `testing/form-state-testing.md`
**Length**: ~280 lines
**Best For**: QA, developers writing tests

**Contains**:
- Manual testing checklist (4 scenarios)
- E2E testing examples with Playwright code
- Regression test to catch this specific bug
- Visual regression testing
- CI/CD integration example
- Common test failures & fixes
- Before shipping checklist

**When to Use**: Planning tests, writing test code


### 7. rules/code-style.md (Updated section)
**File**: `rules/code-style.md`
**Location**: Section "Form State Management"
**Length**: ~25 lines added
**Best For**: Code style reference

**Contains**:
- Critical form state management section
- Wrong/correct code examples
- Links to detailed guide

**When to Use**: Code style reference, included in project documentation


### 8. rules/code-style.md (Existing sections for context)
**Location**: Entire file
**Best For**: Understanding integration with existing rules

**Context**:
- Shows this is integrated into project's code style guidelines
- Part of broader CLAUDE.md ecosystem
- Links to other rules (architecture.md, database.md)

---

## The One Rule to Remember

> **When form values come from props, ALWAYS use `$derived`, never `$state`**

---

## Quick Decision Flow

```
Does this value come from a prop?
│
├─ YES → Use $derived ✓ (REQUIRED)
│
└─ NO
   ├─ Is it temporary UI state? (loading, errors, touched)
   │  └─ YES → Use $state ✓
   │
   └─ Is it derived from other state?
      └─ YES → Use $derived ✓
      └─ NO → Use $state ✓
```

---

## By Use Case

### "I need to write a form right now"
1. Read: `FORM_STATE_QUICK_START.md`
2. Copy template from that file
3. Reference patterns from: `rules/svelte-form-state.md`
4. Add tests from: `testing/form-state-testing.md`

### "I'm reviewing a form component PR"
1. Use checklist: `checklists/form-state-review.md`
2. Look for anti-patterns in: `prevention/svelte-form-state-sync.md`
3. Reference code style: `rules/code-style.md`

### "I want to understand this deeply"
1. Start: `FORM_STATE_QUICK_START.md` (overview)
2. Read: `rules/svelte-form-state.md` (all patterns)
3. Study: `testing/form-state-testing.md` (test examples)
4. Review: `PREVENTION_STRATEGY.md` (impact & roadmap)

### "I need to audit existing code"
1. Search for pattern: `grep -r "let.*\$state.*props\|let.*\$state.*data\." src/`
2. Use guide: `rules/svelte-form-state.md` to fix
3. Add tests: `testing/form-state-testing.md`

### "I'm onboarding someone to this project"
1. Share: `FORM_STATE_QUICK_START.md` (quick start)
2. Assign: `checklists/form-state-review.md` (code review checklist)
3. Reference: `rules/svelte-form-state.md` (for learning)

---

## Anti-Patterns to Spot

### ❌ Pattern 1: `$state` with Prop Value
```svelte
let email = $state(props.email);     // WRONG
let email = $state(data.user?.name); // WRONG
```
**Fix**: Change to `$derived`

### ❌ Pattern 2: {#key} as Workaround
```svelte
{#key formData}
  <input bind:value={email} />
{/key}
```
**Fix**: Use `$derived` instead, remove {#key}

### ❌ Pattern 3: Initial from Prop Only
```svelte
let email = $state(userData.email ?? '');
// Later: userData updates but email doesn't
```
**Fix**: Use `$derived`

### ✓ Correct Pattern
```svelte
let email = $derived(userData.email ?? '');    // From prop
let isLoading = $state(false);                 // Local UI
let errors = $state<Record<string, string>>({}); // Local errors
```

---

## Testing Quick Check

After modifying a form:

1. [ ] Load form with initial data
2. [ ] Edit a field value
3. [ ] Submit form
4. [ ] Verify field **auto-updates** with new value
5. [ ] No manual page refresh needed

**If step 4 fails**: Component is using `$state` instead of `$derived`

---

## Implementation Phases

### Phase 1: Documentation (DONE)
- [x] Create all materials
- [x] Integrate into code style
- [x] Ready for team use

### Phase 2: Code Audit (TODO)
- [ ] Search codebase for anti-patterns
- [ ] Review existing form components
- [ ] File PRs to fix issues

### Phase 3: Team Integration (TODO)
- [ ] Share materials with team
- [ ] Make checklist mandatory for form PRs
- [ ] Add regression tests to CI/CD

### Phase 4: Monitoring (TODO)
- [ ] Track form-related bugs
- [ ] Measure improvement
- [ ] Update materials as needed

---

## File Structure

```
.claude/
├── PREVENTION_STRATEGY.md              ← Start here for overview
├── FORM_STATE_QUICK_START.md           ← Quick fix & template
├── FORM_STATE_MATERIALS_INDEX.md       ← This file
├── rules/
│   ├── code-style.md                   ← Updated with form section
│   ├── svelte-form-state.md            ← Complete guide & patterns
│   ├── architecture.md                 ← Related: component structure
│   └── database.md                     ← Related: data flow
├── checklists/
│   └── form-state-review.md            ← Code review checklist
├── prevention/
│   └── svelte-form-state-sync.md       ← One-page summary
└── testing/
    └── form-state-testing.md           ← Testing guide & examples
```

---

## Search & Find Commands

### Find existing bugs in codebase
```bash
grep -r "let.*\$state.*props\|let.*\$state.*data\." src/
```

### Find all form components
```bash
find src/ -name "*Form*.svelte" -o -name "*form*.svelte"
```

### Find components with props
```bash
grep -l "\$props()" src/**/*.svelte
```

---

## Key Takeaways

1. **The Rule**: `$derived` for props, `$state` for local UI state
2. **The Test**: Form submits → field auto-updates → no manual refresh
3. **The Check**: Look for `$state(props.X)` in code reviews
4. **The Fix**: One-line change from `$state` to `$derived`
5. **The Prevention**: Use decision tree, follow template, add tests

---

## Related Project Documentation

- `CLAUDE.md` - Project overview and architecture
- `rules/architecture.md` - Component structure patterns
- `rules/code-style.md` - Code style (now includes form section)
- `rules/database.md` - Database and data flow patterns

---

## Questions?

**Q: Which document should I start with?**
A: If in a hurry: `FORM_STATE_QUICK_START.md`. If reviewing: `checklists/form-state-review.md`. If learning: `rules/svelte-form-state.md`.

**Q: How do I remember this?**
A: Memorize: "Props → $derived, UI state → $state". That's it.

**Q: Where do I find the template?**
A: In `FORM_STATE_QUICK_START.md` - copy & paste ready.

**Q: How do I test if I fixed it correctly?**
A: Follow "Testing Quick Check" above. Submit → field auto-updates → done.

---

## Document Statistics

| Document | Lines | Time | Best For |
|----------|-------|------|----------|
| FORM_STATE_QUICK_START.md | 200 | 5 min | Quick reference |
| PREVENTION_STRATEGY.md | 350 | 10 min | Overview & impact |
| rules/svelte-form-state.md | 540 | 30 min | Learning |
| checklists/form-state-review.md | 110 | 5 min | Code review |
| prevention/svelte-form-state-sync.md | 100 | 2 min | Quick lookup |
| testing/form-state-testing.md | 280 | 20 min | Testing |
| **TOTAL** | **1,580** | - | - |

---

**Created**: 2026-01-29
**Status**: Ready for Team Use
**Next Step**: Share with team, integrate into code review process
