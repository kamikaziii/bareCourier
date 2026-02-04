<script lang="ts">
  import { enhance, applyAction } from "$app/forms";
  import { invalidateAll } from "$app/navigation";
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Card from "$lib/components/ui/card/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Label } from "$lib/components/ui/label/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import { Switch } from "$lib/components/ui/switch/index.js";
  import { Checkbox } from "$lib/components/ui/checkbox/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { getLocale } from "$lib/paraglide/runtime.js";
  import { toast } from "$lib/utils/toast.js";
  import { Clock, Calendar } from "@lucide/svelte";
  import type {
    Profile,
    PastDueSettings,
    TimeSlotDefinitions,
    WorkingDay,
  } from "$lib/database.types.js";
  import {
    DEFAULT_TIME_SLOTS,
    DEFAULT_WORKING_DAYS,
    DEFAULT_PAST_DUE_SETTINGS,
    VALID_DAYS,
  } from "$lib/constants/scheduling.js";

  interface Props {
    profile: Profile;
  }

  let { profile }: Props = $props();

  // Use shared defaults from constants
  const defaultPastDueSettings = DEFAULT_PAST_DUE_SETTINGS;
  const defaultTimeSlots = DEFAULT_TIME_SLOTS;
  const defaultWorkingDays = DEFAULT_WORKING_DAYS;

  // Past due settings state (initialized from props, synced via effect)
  // svelte-ignore state_referenced_locally
  let pastDueSettings = $state<PastDueSettings>(
    profile.past_due_settings ?? defaultPastDueSettings,
  );
  // svelte-ignore state_referenced_locally
  let timeSlots = $state<TimeSlotDefinitions>(
    profile.time_slots ?? defaultTimeSlots,
  );
  // svelte-ignore state_referenced_locally
  let workingDays = $state<WorkingDay[]>(
    profile.working_days ?? defaultWorkingDays,
  );

  // Sync with props after form submission
  $effect(() => {
    pastDueSettings = profile.past_due_settings ?? defaultPastDueSettings;
    timeSlots = profile.time_slots ?? defaultTimeSlots;
    workingDays = profile.working_days ?? defaultWorkingDays;
  });

  // All days of the week for iteration
  const allDays = VALID_DAYS;

  // Message lookup for day names
  const dayMessages: Record<WorkingDay, () => string> = {
    monday: m.day_monday,
    tuesday: m.day_tuesday,
    wednesday: m.day_wednesday,
    thursday: m.day_thursday,
    friday: m.day_friday,
    saturday: m.day_saturday,
    sunday: m.day_sunday,
  };

  // Message lookup for time slot names
  const slotMessages: Record<
    "morning" | "afternoon" | "evening",
    () => string
  > = {
    morning: m.settings_time_slot_morning,
    afternoon: m.settings_time_slot_afternoon,
    evening: m.settings_time_slot_evening,
  };

  function toggleWorkingDay(day: WorkingDay, checked: boolean) {
    if (checked) {
      if (!workingDays.includes(day)) {
        workingDays = [...workingDays, day];
      }
    } else {
      workingDays = workingDays.filter((d) => d !== day);
    }
  }
</script>

<!-- Time Slot Definitions -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Clock class="size-5" />
      {m.settings_time_slots()}
    </Card.Title>
    <Card.Description>{m.settings_time_slots_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form
      method="POST"
      action="?/updateTimeSlots"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_scheduling_saved());
          } else if (result.type === "failure") {
            toast.error(m.toast_settings_failed(), { duration: 8000 });
          }
        };
      }}
      class="space-y-4"
    >
      {#each ["morning", "afternoon", "evening"] as slot (slot)}
        {@const slotKey = slot as "morning" | "afternoon" | "evening"}
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <Label>{slotMessages[slotKey]()}</Label>
          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground"
              >{m.settings_time_slot_start()}</Label
            >
            <Input
              type="time"
              lang={getLocale()}
              name="{slot}_start"
              bind:value={timeSlots[slotKey].start}
            />
          </div>
          <div class="space-y-1">
            <Label class="text-xs text-muted-foreground"
              >{m.settings_time_slot_end()}</Label
            >
            <Input
              type="time"
              lang={getLocale()}
              name="{slot}_end"
              bind:value={timeSlots[slotKey].end}
            />
          </div>
        </div>
      {/each}
      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>

<!-- Working Days -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Calendar class="size-5" />
      {m.settings_working_days()}
    </Card.Title>
    <Card.Description>{m.settings_working_days_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form
      method="POST"
      action="?/updateWorkingDays"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_scheduling_saved());
          } else if (result.type === "failure") {
            toast.error(m.toast_settings_failed(), { duration: 8000 });
          }
        };
      }}
      class="space-y-4"
    >
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {#each allDays as day (day)}
          <label class="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={workingDays.includes(day)}
              onCheckedChange={(checked) =>
                toggleWorkingDay(day, checked === true)}
            />
            <span class="text-sm">{dayMessages[day]()}</span>
          </label>
        {/each}
      </div>
      <!-- Hidden inputs to ensure all checked days are submitted -->
      {#each workingDays as day (day)}
        <input type="hidden" name="working_days" value={day} />
      {/each}
      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>

<!-- Delivery Deadlines -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Clock class="size-5" />
      {m.settings_delivery_deadlines()}
    </Card.Title>
    <Card.Description>{m.settings_delivery_deadlines_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form
      method="POST"
      action="?/updatePastDueSettings"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_scheduling_saved());
          } else if (result.type === "failure") {
            toast.error(m.toast_settings_failed(), { duration: 8000 });
          }
        };
      }}
      class="space-y-6"
    >
      <!-- Grace period (standard) -->
      <div class="space-y-2">
        <Label for="gracePeriodStandard"
          >{m.settings_grace_period_standard()}</Label
        >
        <div class="flex items-center gap-2">
          <Input
            id="gracePeriodStandard"
            name="gracePeriodStandard"
            type="number"
            min="0"
            max="60"
            bind:value={pastDueSettings.gracePeriodStandard}
            class="w-24"
          />
          <span class="text-sm text-muted-foreground"
            >{m.settings_minutes()}</span
          >
        </div>
        <p class="text-xs text-muted-foreground">
          {m.settings_grace_period_standard_desc()}
        </p>
      </div>

      <!-- Grace period (specific) -->
      <div class="space-y-2">
        <Label for="gracePeriodSpecific"
          >{m.settings_grace_period_specific()}</Label
        >
        <div class="flex items-center gap-2">
          <Input
            id="gracePeriodSpecific"
            name="gracePeriodSpecific"
            type="number"
            min="0"
            max="30"
            bind:value={pastDueSettings.gracePeriodSpecific}
            class="w-24"
          />
          <span class="text-sm text-muted-foreground"
            >{m.settings_minutes()}</span
          >
        </div>
        <p class="text-xs text-muted-foreground">
          {m.settings_grace_period_specific_desc()}
        </p>
      </div>

      <Separator />

      <!-- Approaching threshold -->
      <div class="space-y-2">
        <Label for="thresholdApproaching"
          >{m.settings_threshold_approaching()}</Label
        >
        <div class="flex items-center gap-2">
          <Input
            id="thresholdApproaching"
            name="thresholdApproaching"
            type="number"
            min="30"
            max="180"
            bind:value={pastDueSettings.thresholdApproaching}
            class="w-24"
          />
          <span class="text-sm text-muted-foreground"
            >{m.settings_minutes()}</span
          >
        </div>
        <p class="text-xs text-muted-foreground">
          {m.settings_threshold_approaching_desc()}
        </p>
      </div>

      <!-- Urgent threshold -->
      <div class="space-y-2">
        <Label for="thresholdUrgent">{m.settings_threshold_urgent()}</Label>
        <div class="flex items-center gap-2">
          <Input
            id="thresholdUrgent"
            name="thresholdUrgent"
            type="number"
            min="15"
            max="120"
            bind:value={pastDueSettings.thresholdUrgent}
            class="w-24"
          />
          <span class="text-sm text-muted-foreground"
            >{m.settings_minutes()}</span
          >
        </div>
        <p class="text-xs text-muted-foreground">
          {m.settings_threshold_urgent_desc()}
        </p>
      </div>

      <!-- Critical threshold -->
      <div class="space-y-2">
        <Label for="thresholdCriticalHours"
          >{m.settings_threshold_critical()}</Label
        >
        <div class="flex items-center gap-2">
          <Input
            id="thresholdCriticalHours"
            name="thresholdCriticalHours"
            type="number"
            min="1"
            max="72"
            bind:value={pastDueSettings.thresholdCriticalHours}
            class="w-24"
          />
          <span class="text-sm text-muted-foreground">{m.settings_hours()}</span
          >
        </div>
        <p class="text-xs text-muted-foreground">
          {m.settings_threshold_critical_desc()}
        </p>
      </div>

      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>

<!-- Client Rescheduling -->
<Card.Root>
  <Card.Header>
    <Card.Title class="flex items-center gap-2">
      <Clock class="size-5" />
      {m.settings_client_rescheduling()}
    </Card.Title>
    <Card.Description>{m.settings_client_rescheduling_desc()}</Card.Description>
  </Card.Header>
  <Card.Content>
    <form
      method="POST"
      action="?/updateClientRescheduleSettings"
      use:enhance={async () => {
        return async ({ result }) => {
          await applyAction(result);
          if (result.type === "success") {
            await invalidateAll();
            toast.success(m.toast_scheduling_saved());
          } else if (result.type === "failure") {
            toast.error(m.toast_settings_failed(), { duration: 8000 });
          }
        };
      }}
      class="space-y-6"
    >
      <!-- Allow client reschedule toggle -->
      <div class="flex items-center justify-between">
        <div class="space-y-0.5">
          <Label>{m.settings_allow_client_reschedule()}</Label>
          <p class="text-sm text-muted-foreground">
            {m.settings_allow_client_reschedule_desc()}
          </p>
        </div>
        <input
          type="hidden"
          name="allowClientReschedule"
          value={pastDueSettings.allowClientReschedule.toString()}
        />
        <Switch
          checked={pastDueSettings.allowClientReschedule}
          onCheckedChange={(checked) => {
            pastDueSettings = {
              ...pastDueSettings,
              allowClientReschedule: checked,
            };
          }}
        />
      </div>

      {#if pastDueSettings.allowClientReschedule}
        <Separator />

        <!-- Minimum notice hours -->
        <div class="space-y-2">
          <Label for="clientMinNoticeHours"
            >{m.settings_client_min_notice()}</Label
          >
          <div class="flex items-center gap-2">
            <Input
              id="clientMinNoticeHours"
              name="clientMinNoticeHours"
              type="number"
              min="1"
              max="72"
              bind:value={pastDueSettings.clientMinNoticeHours}
              class="w-24"
            />
            <span class="text-sm text-muted-foreground"
              >{m.settings_hours()}</span
            >
          </div>
          <p class="text-xs text-muted-foreground">
            {m.settings_client_min_notice_desc()}
          </p>
        </div>

        <!-- Max reschedules -->
        <div class="space-y-2">
          <Label for="clientMaxReschedules"
            >{m.settings_client_max_reschedules()}</Label
          >
          <Input
            id="clientMaxReschedules"
            name="clientMaxReschedules"
            type="number"
            min="1"
            max="10"
            bind:value={pastDueSettings.clientMaxReschedules}
            class="w-24"
          />
          <p class="text-xs text-muted-foreground">
            {m.settings_client_max_reschedules_desc()}
          </p>
        </div>
      {/if}

      <Button type="submit">{m.action_save()}</Button>
    </form>
  </Card.Content>
</Card.Root>
