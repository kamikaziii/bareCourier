# Form State Management Code Review Checklist

Use this checklist when reviewing form components to catch state sync issues early.

## Before Review
- [ ] Identify if component receives form data via props
- [ ] Locate all state declarations (`$state`, `$derived`)
- [ ] Identify which state is UI-specific vs form-value state

## State Declaration Review

For each state variable in the component:

```
[State Variable]
  [ ] Is this value derived from a prop?
        YES → Must use $derived
        NO → Check next item
  [ ] Is this temporary UI state (loading, error, touched)?
        YES → Use $state ✓
        NO → Check next item
  [ ] Is this derived from other state/values?
        YES → Must use $derived
        NO → Use $state ✓
```

## Common Anti-Patterns

- [ ] ❌ `let email = $state(props.email)` - Should be `$derived`
- [ ] ❌ `let name = $state(data.user?.name)` - Should be `$derived`
- [ ] ❌ {#key formData} {...} - Use $derived instead, not {#key}
- [ ] ❌ `$state` with initial value from prop - Use `$derived`

## Form Value Binding

Check each form input:

- [ ] Input values are either:
  - [ ] Bound to `$derived` (from props)
  - [ ] Bound to `$state` (local/UI state)
  - [ ] NOT bound to initial prop values via `$state`

## After Form Submission

Test the flow:

- [ ] Form submits successfully
- [ ] Parent component updates prop with new data
- [ ] Form fields automatically display updated values
- [ ] NO manual page refresh needed
- [ ] NO {#key} blocks to force re-render

## Edge Cases

- [ ] Multiple forms on page - each uses $derived from own props
- [ ] Radio/checkbox buttons - derived from prop, handler updates local state
- [ ] Reset form button - navigates away or reloads data (not {#key})
- [ ] Form with validation - errors are $state, display values are $derived

## Quick Questions

1. **Does form data come from props?**
   - YES → All form values should be `$derived`
   - NO → Can use `$state` for user input

2. **After form submission, do fields automatically show new data?**
   - NO → Likely missing `$derived` on form values
   - YES → State management is correct

3. **Do you see {#key} blocks in the form?**
   - YES → Check if they're working around state sync issues (replace with `$derived`)
   - NO → Continue review

## Testing Recommendations

- [ ] Manual: Edit form → submit → verify fields update
- [ ] Manual: Change selected item → verify form resets to new data
- [ ] E2E: Form submission flow returns updated data and displays it
- [ ] E2E: Navigation between items shows correct data per item

## Reference

- See [svelte-form-state.md](../rules/svelte-form-state.md) for patterns
- See [code-style.md](../rules/code-style.md) for Svelte 5 syntax rules
