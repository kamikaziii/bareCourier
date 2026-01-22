# Mobile-Friendly Navigation

---
status: ready
priority: p3
issue_id: "026"
tags: [code-review, ux, mobile, navigation]
dependencies: ["023"]
---

## Problem Statement

The courier navigation has 9 horizontal items that overflow on mobile screens, requiring horizontal scroll. This is not an ideal mobile experience for a PWA that's meant to be used on the go.

**Why it matters**: As a PWA for a solo courier, mobile experience is critical. The current horizontal scroll nav is awkward on phones.

## Findings

- **Location**: `src/routes/courier/+layout.svelte`
- **Agent**: UX Review

**Current Implementation**:
```svelte
<nav class="border-b bg-muted/40">
  <div class="container flex gap-1 overflow-x-auto px-4 py-2">
    {#each navItems as item (item.href)}
      <a href={localizeHref(item.href)} class="...">
        {item.label}
      </a>
    {/each}
  </div>
</nav>
```

**Issues**:
- `overflow-x-auto` creates horizontal scroll on mobile
- No visual indicator that more items exist off-screen
- Users may not discover all navigation options
- Touch scrolling on nav bar is awkward

## Proposed Solutions

### Option 1: Bottom Navigation for Mobile (Recommended)
Add a fixed bottom nav bar on mobile screens with primary actions, hide top nav.

**Implementation**:
```svelte
<!-- Top nav for desktop only -->
<nav class="hidden md:block border-b bg-muted/40">
  <!-- existing nav -->
</nav>

<!-- Bottom nav for mobile only -->
<nav class="fixed bottom-0 left-0 right-0 z-50 border-t bg-background md:hidden">
  <div class="container flex justify-around py-2">
    <a href={localizeHref('/courier')} class="flex flex-col items-center gap-1 text-xs">
      <Home class="size-5" />
      <span>{m.nav_dashboard()}</span>
    </a>
    <a href={localizeHref('/courier/services')} class="flex flex-col items-center gap-1 text-xs">
      <Package class="size-5" />
      <span>{m.nav_services()}</span>
    </a>
    <a href={localizeHref('/courier/requests')} class="flex flex-col items-center gap-1 text-xs">
      <Inbox class="size-5" />
      <span>{m.nav_requests()}</span>
    </a>
    <a href={localizeHref('/courier/calendar')} class="flex flex-col items-center gap-1 text-xs">
      <CalendarIcon class="size-5" />
      <span>{m.nav_calendar()}</span>
    </a>
    <button class="flex flex-col items-center gap-1 text-xs" onclick={openMobileMenu}>
      <Menu class="size-5" />
      <span>{m.nav_more()}</span>
    </button>
  </div>
</nav>

<!-- Mobile menu drawer for remaining items -->
<Sheet bind:open={mobileMenuOpen}>
  <SheetContent side="bottom">
    <nav class="grid gap-2">
      <a href={localizeHref('/courier/clients')}>...</a>
      <a href={localizeHref('/courier/billing')}>...</a>
      <!-- etc -->
    </nav>
  </SheetContent>
</Sheet>
```

Add padding to main content:
```svelte
<main class="container px-4 py-6 pb-20 md:pb-6">
```

**Pros**: Native mobile feel, always accessible, familiar pattern
**Cons**: Requires Sheet component, more complex
**Effort**: Medium
**Risk**: Low

### Option 2: Hamburger Menu
Replace top nav with hamburger menu on mobile.

**Pros**: Common pattern, simple
**Cons**: Hides all navigation, extra tap to access anything
**Effort**: Small
**Risk**: Low

### Option 3: Scrollable Tabs with Indicators
Keep horizontal scroll but add visual indicators (fade edges, dots).

**Pros**: Minimal change
**Cons**: Still requires scrolling, not ideal mobile UX
**Effort**: Small
**Risk**: Low

### Option 4: Reduce Nav Items First
Complete todo #023 first to reduce items to 7, then reassess.

**Pros**: Might make current nav acceptable
**Cons**: 7 items may still overflow on small screens
**Effort**: Depends on #023
**Risk**: Low

## Recommended Action

Option 4 first (reduce nav items), then Option 1 if still needed.

## Technical Details

**Affected Files**:
- `src/routes/courier/+layout.svelte`
- Optionally: `src/routes/client/+layout.svelte` (client has fewer items, may not need)

**New Components Needed**:
- Sheet/Drawer component (may need to add from shadcn-svelte)
- Icons for bottom nav

**Bottom Nav Items (5 max)**:
1. Dashboard (Home icon)
2. Services (Package icon)
3. Requests (Inbox icon)
4. Calendar (Calendar icon)
5. More (Menu icon) → opens drawer

**"More" Drawer Contains**:
- Clients
- Billing
- Analytics/Insights
- Settings

## Acceptance Criteria

- [ ] Mobile screens show bottom navigation
- [ ] Desktop screens show top navigation (unchanged)
- [ ] Primary actions accessible with one tap
- [ ] Secondary actions in "More" menu
- [ ] Main content has bottom padding on mobile
- [ ] Active state indicator on current page
- [ ] PWA safe area respected

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-22 | Identified during UX review | 9 nav items overflow on mobile |
| 2026-01-22 | Approved during triage | Status changed to ready - ready to implement |

## Resources

- shadcn-svelte Sheet: https://shadcn-svelte.com/docs/components/sheet
- Mobile nav patterns: iOS/Android tab bars
