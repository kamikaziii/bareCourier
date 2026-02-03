# bareCourier - Suggested Commands

## Development
```bash
pnpm run dev              # Start dev server at localhost:5173
pnpm run build            # Production build
pnpm run preview          # Preview production build
```

## Type Checking
```bash
pnpm run check            # TypeScript + Svelte check (run before commits)
pnpm run check:watch      # Watch mode for development
```

## Testing
```bash
pnpm exec playwright test              # Run all E2E tests
pnpm exec playwright test --ui         # Interactive test UI
pnpm exec playwright test <file>       # Run specific test file
```

## shadcn-svelte Components
```bash
pnpm dlx shadcn-svelte@latest add [component] --yes
```

## PWA Assets
```bash
pnpm run generate-pwa-assets   # Regenerate all PWA icons/splash screens
```

## Supabase
```bash
supabase db push               # Apply migrations to remote
supabase gen types typescript --project-id $PROJECT_ID > src/lib/database.generated.ts
supabase inspect db lint       # Check for security issues
```

## Git
```bash
git status                     # Check working tree
git diff                       # View changes
git log --oneline -10          # Recent commits
```

## System Utilities (macOS/Darwin)
```bash
ls -la                         # List files with details
find . -name "*.svelte"        # Find files by pattern
grep -r "pattern" src/         # Search in files
```
