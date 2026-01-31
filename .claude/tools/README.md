# Development Tools

This directory contains development and code quality tools for the bareCourier project.

## Available Tools

### detect-derived-mutations.sh

Detects potential Svelte 5 `$derived` mutation anti-patterns.

**Usage:**
```bash
./.claude/tools/detect-derived-mutations.sh
```

**What it checks:**
- `$derived` variables with array mutation methods (`.push()`, `.splice()`, etc.)
- `$derived` variables with direct index assignment (`array[index] = value`)

**Exit codes:**
- `0` - No issues found
- `1` - Potential issues detected

**Example:**
```bash
$ ./.claude/tools/detect-derived-mutations.sh

🔍 Scanning for potential $derived mutation anti-patterns...

⚠️  POTENTIAL BUG: src/routes/example/+page.svelte
   Variable 'items' is $derived but has array mutation:
   45:     items.push(newItem);

❌ Found 1 potential issue(s)

💡 How to fix:
   1. Use $state instead of $derived for values that need mutations
   2. Use immutable updates:
      • items = [...items, newItem]  (not items.push(newItem))
      • items = items.filter(...)     (not items.splice(...))
```

**See also:**
- [svelte-reactive-mutation-prevention.md](../.claude/rules/svelte-reactive-mutation-prevention.md) - Prevention strategies
- [svelte-form-state.md](../.claude/rules/svelte-form-state.md) - Form state patterns

---

## CI/CD Integration

Add to your CI workflow:

```yaml
# .github/workflows/ci.yml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check for $derived mutations
        run: ./.claude/tools/detect-derived-mutations.sh
```

---

## Contributing

When adding new tools:

1. Make scripts executable: `chmod +x .claude/tools/your-script.sh`
2. Use project-relative paths (detect project root from script location)
3. Provide clear error messages and exit codes
4. Document the tool in this README
5. Add usage examples
