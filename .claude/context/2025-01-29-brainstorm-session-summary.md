# Brainstorming Session Summary - 2025-01-29

**Duration:** Extended session
**Participants:** Filipe Garrido + Claude
**Primary Source:** WhatsApp conversation with Agostinho (courier)

---

## Session Overview

This session analyzed real user requirements from WhatsApp conversations with Agostinho, the solo courier who will use bareCourier. Two major features were designed:

1. **Service Details Enhancements** - Display IDs, recipient info, printable labels
2. **Pricing Model Redesign** - Type-based pricing with geographic zones

---

## Documents Created

| Document | Status | Description |
|----------|--------|-------------|
| `2025-01-29-service-details-enhancements.md` | ✅ Approved | Design for display IDs, recipient fields, labels |
| `2025-01-29-service-details-implementation.md` | ✅ Complete | 15-task implementation plan |
| `2025-01-29-pricing-model-redesign.md` | 🔄 In Progress | Type-based pricing design |

---

## Feature 1: Service Details Enhancements

### Problem
- No human-readable service IDs for phone reference
- No way to track delivery recipient (often different from client)
- No printable labels for packages

### Solution
- Auto-generated display IDs: `#25-0142` format (year-sequential)
- Recipient name/phone fields (optional)
- Customer reference field (client's PO number)
- Printable labels with QR codes and courier branding

### Key Decisions
- Counter table pattern for ID generation (no cron needed)
- Labels show both FROM and TO addresses
- Courier configures label branding in settings
- QR code links to tracking page (page deferred)

### Implementation Status
- Design: ✅ Complete
- Implementation Plan: ✅ Complete (15 tasks)
- Code: ⏳ Not started

---

## Feature 2: Pricing Model Redesign

### Problem
Current system is distance-based (`per_km`, `zone`, `flat_plus_km`), but Agostinho's actual pricing is:
- Type-based (Dental €4, Optical €3)
- Geographic zones (municipalities, not distance)
- Fixed prices for special cases (€13 for time-specific or out-of-zone)

### Agostinho's Confirmed Pricing Model

| Scenario | Price |
|----------|-------|
| Normal in-zone | Base type (€4 dental, €3 optical) |
| Time-specific (any) | €13 flat (replaces base) |
| Out-of-zone (any) | €13 + €0.50/km + tolls |

### Key Discoveries from Chat
1. **"Serviço Especial"** = €13, used for time-specific AND out-of-zone base
2. **Zones = municipalities** (Porto, Maia, Matosinhos, Gondomar), not distance
3. **Tolls = exact amount** (manual entry)
4. **€13 replaces base type**, doesn't add to it
5. **Each client has default type** (dental client always dental)

### Design Decisions
- Keep both pricing systems (type-based + distance-based)
- Global setting with per-client override
- Courier manages global service types
- Structured selection of Portuguese municipalities
- Auto-detect zone from delivery address (Mapbox)

### Implementation Status
- Design: 🔄 In progress
- Implementation Plan: ⏳ Not started
- Code: ⏳ Not started

---

## Other Features Identified (Not Designed)

From WhatsApp chat analysis:

| Feature | Priority | Notes |
|---------|----------|-------|
| Moloni invoicing integration | Low | Requires Moloni Flex plan |
| Portable thermal printer | Low | Deferred (browser print first) |
| Public tracking page | Medium | QR code destination |
| Quote/budget mode | Medium | Manual pricing for special cases |
| Push notifications | Medium | Real-time alerts while driving |

---

## Research Conducted

### Best Practices Research (via `best-practices-researcher` agent)

1. **Service ID Formats** - Industry patterns from UPS, FedEx, DHL
2. **Counter Table Pattern** - PostgreSQL year-based sequential IDs
3. **Shipping Label Design** - GS1 standards, zone layout, typography
4. **Portuguese Address Format** - Concelho extraction, postal codes

### Key Sources
- GS1 Logistic Label Guidelines
- Supabase pg_cron documentation
- PostgreSQL sequence patterns
- Portuguese municipality (concelho) structure

---

## Skills Used

| Skill | Purpose |
|-------|---------|
| `superpowers:brainstorming` | Structured feature design process |
| `superpowers:writing-plans` | Implementation plan creation |
| `compound-engineering:research:best-practices-researcher` | Industry standards research |

---

## WhatsApp Chat Reference

**File:** `/Users/filipegarrido/Downloads/_chat 3.txt`

**Key Lines:**
- 137: Different prices for dental vs optical
- 141: €4 within distribution zones
- 157: €13 for time-specific services
- 160: Out-of-zone = €0.50/km + serviço especial + tolls
- 189-192: Confirmed prices and zone definition
- 85-99: Printable labels requirement
- 174-176: Client default type assignment

---

## Next Steps

1. **Finish pricing model design** - Resolve open questions
2. **Write pricing implementation plan** - Using `superpowers:writing-plans`
3. **Implement service details first** - Already has complete plan
4. **Implement pricing model second** - Depends on design completion

---

## Context for Future Sessions

When resuming this work:

1. Read `docs/plans/2025-01-29-service-details-implementation.md` for display IDs, recipient, labels
2. Read `docs/plans/2025-01-29-pricing-model-redesign.md` for type-based pricing
3. WhatsApp chat at `/Users/filipegarrido/Downloads/_chat 3.txt` has original requirements
4. Current pricing code at `src/lib/services/pricing.ts`
