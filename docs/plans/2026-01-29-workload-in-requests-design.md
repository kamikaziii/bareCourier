# Workload Display in Service Requests

**Date:** 2026-01-29
**Status:** Approved

## Problem

When a courier reviews pending service requests, they decide whether to accept, suggest an alternative date, or reject—without any visibility into their workload for the requested date. This leads to blind decision-making and potential overcommitment.

## Solution

Display workload data alongside each pending request so the courier can see their capacity before making decisions.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Placement | Both: compact badge on cards + expandable details in dialogs |
| Card badge content | Status + service count (e.g., "✅ Compatível · 3 serviços") |
| Dialog detail level | Expandable: summary by default, full breakdown on expand |
| Suggest dialog helper | Show next compatible day with auto-fill button |
| Overload warning style | Subtle indicator (red status badge only, no extra text) |
| No-date requests | Show today + tomorrow, suggest next compatible if neither fits |
| Component approach | New compact `WorkloadSummary.svelte` component |

## New Component: WorkloadSummary.svelte

A compact, single-line workload indicator with optional expansion.

### Collapsed State
```
┌─────────────────────────────────────────────┐
│ ✅ Compatível · 3 serviços · 2h folga    ▼ │
└─────────────────────────────────────────────┘
```

### Expanded State
```
┌─────────────────────────────────────────────┐
│ ✅ Compatível · 3 serviços · 2h folga    ▲ │
├─────────────────────────────────────────────┤
│ Condução:         1h 30m                    │
│ Tempo serviço:    45m                       │
│ Pausas:           1h                        │
│ ───────────────────────────────             │
│ Total necessário: 3h 15m                    │
└─────────────────────────────────────────────┘
```

### Props

```typescript
interface Props {
  workload: WorkloadEstimate;
  dateLabel?: string;      // e.g., "Terça, 4 Fev" - shown above status
  compact?: boolean;       // For card badges: no expand, just status + count
}
```

### Status Labels

Uses existing terminology from WorkloadCard:
- `comfortable` → "Compatível" (green)
- `tight` → "Apertado" (yellow)
- `overloaded` → "Sobrecarregado" (red)

## Integration Points

### 1. Request Cards

Add compact workload badge below the requested date:

```
┌─────────────────────────────────────────────────────┐
│ João Silva                          📞 912 345 678 │
│                                                     │
│ 🔵 De: Rua Augusta 45, Lisboa                      │
│ 🟢 Para: Av. da Liberdade 100, Lisboa              │
│                                                     │
│ 📅 Pedido: Terça, 4 Fev - Manhã                    │
│ ✅ Compatível · 3 serviços    ← NEW                │
│                                                     │
│ 📝 Entregar na receção                             │
│                                                     │
│              [Aceitar] [Sugerir] [Rejeitar]        │
└─────────────────────────────────────────────────────┘
```

### 2. Accept Dialog

Show expandable workload for the requested date:

```
┌─────────────────────────────────────────────────────┐
│ Confirmar aceitação                           [X]  │
├─────────────────────────────────────────────────────┤
│ O serviço será agendado para a data pedida.        │
│                                                     │
│ João Silva                                          │
│ De: Rua Augusta 45, Lisboa                         │
│ Para: Av. da Liberdade 100, Lisboa                 │
│ Terça, 4 Fev - Manhã                               │
│                                                     │
│ ┌─────────────────────────────────────────────┐    │
│ │ 🟡 Apertado · 5 serviços · 45m folga     ▼ │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│                        [Cancelar]  [Aceitar]       │
└─────────────────────────────────────────────────────┘
```

### 3. Suggest Dialog

Show requested date workload + next compatible day suggestion:

```
┌─────────────────────────────────────────────────────┐
│ Sugerir nova data                             [X]  │
├─────────────────────────────────────────────────────┤
│ Pedido original: Terça, 4 Fev - Manhã              │
│ ┌─────────────────────────────────────────────┐    │
│ │ 🔴 Sobrecarregado · 8 serviços · -1h     ▼ │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ ┌─────────────────────────────────────────────┐    │
│ │ 💡 Próximo dia compatível: Quinta, 6 Fev   │    │
│ │                              [Usar esta data]│    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ ─────────────────────────────────────────────      │
│ Nova data sugerida:                                │
│ [📅 Selecionar data    ] [Manhã ▼] [--:--]        │
│                                                     │
│                       [Cancelar]  [Enviar sugestão]│
└─────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows workload for originally requested date
- Scans ahead up to 14 days to find next "Compatível" day
- "Usar esta data" button auto-fills the date picker
- Suggestion box hidden if requested date is already compatible

### 4. No Requested Date

When request has no specific date, show today + tomorrow:

**On card:**
```
│ 📅 Pedido: Sem data específica                     │
│ Hoje: 🟡 Apertado · 5 serviços                     │
```

**In Accept dialog:**
```
│ ┌─────────────────────────────────────────────┐    │
│ │ Hoje (Seg, 3 Fev)                           │    │
│ │ 🟡 Apertado · 5 serviços · 45m folga     ▼ │    │
│ └─────────────────────────────────────────────┘    │
│ ┌─────────────────────────────────────────────┐    │
│ │ Amanhã (Ter, 4 Fev)                         │    │
│ │ 🔴 Sobrecarregado · 8 serviços · -1h     ▼ │    │
│ └─────────────────────────────────────────────┘    │
│                                                     │
│ ┌─────────────────────────────────────────────┐    │
│ │ 💡 Próximo dia compatível: Quinta, 6 Fev   │    │
│ └─────────────────────────────────────────────┘    │
```

**Logic:**
- Always show today + tomorrow workload
- If neither is "Compatível", show next compatible day suggestion
- If at least one is comfortable, hide the suggestion

## Data Flow

### Server-side Changes (`+page.server.ts`)

```typescript
export const load: PageServerLoad = async ({ locals }) => {
  // ... existing code ...

  // Get courier settings for workload calculation
  const { data: courierProfile } = await supabase
    .from('profiles')
    .select('workload_settings')
    .eq('role', 'courier')
    .single();

  const settings = getWorkloadSettings(courierProfile?.workload_settings);

  // Collect unique dates from requests
  const uniqueDates = new Set<string>();
  for (const req of pendingRequests) {
    if (req.requested_date) {
      uniqueDates.add(req.requested_date);
    }
  }

  // Always include today and tomorrow
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayStr = today.toISOString().split('T')[0];
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  uniqueDates.add(todayStr);
  uniqueDates.add(tomorrowStr);

  // Calculate workload for each unique date
  const workloadByDate: Record<string, WorkloadEstimate> = {};
  for (const dateStr of uniqueDates) {
    const date = new Date(dateStr);
    workloadByDate[dateStr] = await calculateDayWorkload(
      supabase, courierId, date, settings
    );
  }

  // Find next compatible day (scan up to 14 days ahead)
  let nextCompatibleDay: { date: string; workload: WorkloadEstimate } | null = null;
  for (let i = 0; i < 14; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() + i);
    const checkDateStr = checkDate.toISOString().split('T')[0];

    // Use cached workload if available, otherwise calculate
    const workload = workloadByDate[checkDateStr]
      || await calculateDayWorkload(supabase, courierId, checkDate, settings);

    if (workload.status === 'comfortable') {
      nextCompatibleDay = { date: checkDateStr, workload };
      break;
    }
  }

  return {
    pendingRequests,
    pendingReschedules,
    workloadByDate,
    todayWorkload: workloadByDate[todayStr],
    tomorrowWorkload: workloadByDate[tomorrowStr],
    nextCompatibleDay
  };
};
```

### Performance Considerations

- Workload calculations are cached by date (one calculation per unique date)
- Multiple requests for same day share the same workload data
- Next compatible day search is bounded to 14 days

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/components/WorkloadSummary.svelte` | **NEW** - Compact workload indicator |
| `src/routes/courier/requests/+page.server.ts` | Add workload calculations to load function |
| `src/routes/courier/requests/+page.svelte` | Integrate badges on cards and in dialogs |
| `messages/en.json` | New translation keys |
| `messages/pt-PT.json` | New translation keys |

## New Translation Keys

```json
{
  "workload_next_compatible": "Próximo dia compatível",
  "workload_use_this_date": "Usar esta data",
  "workload_today": "Hoje",
  "workload_tomorrow": "Amanhã",
  "workload_no_date_requested": "Sem data específica",
  "workload_buffer": "{time} folga"
}
```

## Out of Scope (YAGNI)

- Per-service details in request dialogs
- Full 7-day calendar view with workloads
- Automatic rejection of overloaded days
- Workload predictions that account for the new service being added

## Testing Checklist

- [ ] Card badge shows correct status for requested date
- [ ] Card badge shows "Hoje" status when no date requested
- [ ] Accept dialog shows expandable workload
- [ ] Suggest dialog shows requested date workload
- [ ] Suggest dialog shows next compatible day when appropriate
- [ ] "Usar esta data" button auto-fills date picker
- [ ] No-date requests show today + tomorrow
- [ ] Next compatible suggestion hidden when today/tomorrow is comfortable
- [ ] Status colors match existing WorkloadCard (green/yellow/red)
- [ ] All text properly localized (PT-PT and EN)
