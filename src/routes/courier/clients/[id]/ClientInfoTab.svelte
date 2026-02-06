<script lang="ts" module>
  // Module-level cache for client status checks
  // This cache persists across component instances within the same session
  type ClientStatusData = { isConfirmed: boolean; email: string | null };
  const clientStatusCache = new Map<
    string,
    ClientStatusData & { checkedAt: number }
  >();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  const CACHE_MAX_SIZE = 100;

  function setClientStatusCache(clientId: string, data: ClientStatusData) {
    // Evict oldest entry if at capacity (Map maintains insertion order)
    if (clientStatusCache.size >= CACHE_MAX_SIZE) {
      const oldestKey = clientStatusCache.keys().next().value;
      if (oldestKey) clientStatusCache.delete(oldestKey);
    }
    clientStatusCache.set(clientId, {
      ...data,
      checkedAt: Date.now(),
    });
  }

  export function clearClientStatusCache(clientId: string) {
    clientStatusCache.delete(clientId);
  }
</script>

<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Separator } from "$lib/components/ui/separator/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { formatDate } from "$lib/utils.js";
  import { PUBLIC_SUPABASE_URL } from "$env/static/public";
  import { User, MapPin, Phone, Mail, Send } from "@lucide/svelte";
  import type { Profile } from "$lib/database.types";
  import type { SupabaseClient } from "@supabase/supabase-js";
  import { toast } from "$lib/utils/toast.js";

  let {
    client,
    supabase,
  }: {
    client: Profile;
    supabase: SupabaseClient;
  } = $props();

  // Invitation status
  let clientIsConfirmed = $state<boolean | null>(null);
  let clientEmail = $state<string | null>(null);
  let checkingStatus = $state(true);
  let resendingInvitation = $state(false);

  // Check client email confirmation status on mount
  $effect(() => {
    checkClientStatus();
  });

  async function checkClientStatus() {
    const clientId = client.id;

    // Check cache first
    const cached = clientStatusCache.get(clientId);
    if (cached && Date.now() - cached.checkedAt < CACHE_TTL) {
      clientIsConfirmed = cached.isConfirmed;
      clientEmail = cached.email;
      checkingStatus = false;
      return;
    }

    checkingStatus = true;
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        checkingStatus = false;
        return;
      }

      const response = await fetch(
        `${PUBLIC_SUPABASE_URL}/functions/v1/check-client-status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ client_id: clientId }),
        },
      );

      if (response.ok) {
        const result = await response.json();
        clientIsConfirmed = result.is_confirmed;
        clientEmail = result.email;

        // Cache the result
        setClientStatusCache(clientId, {
          isConfirmed: result.is_confirmed,
          email: result.email,
        });
      }
    } catch (err) {
      // Status check failure is non-critical - button simply won't show
      console.debug("Failed to check client invitation status:", err);
    }
    checkingStatus = false;
  }

  async function handleResendInvitation() {
    resendingInvitation = true;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        toast.error(m.session_expired(), { duration: 8000 });
        resendingInvitation = false;
        return;
      }

      const response = await fetch(
        `${PUBLIC_SUPABASE_URL}/functions/v1/create-client`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            email: clientEmail,
            name: client.name,
            send_invitation: true,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        if (response.status === 429 && result.error?.code === "RATE_LIMIT") {
          const minutes = Math.ceil(
            (result.error.retryAfterMs || 3600000) / 60000,
          );
          toast.error(m.rate_limit_wait({ minutes }), { duration: 8000 });
        } else {
          toast.error(m.error_generic(), { duration: 8000 });
        }
      } else if (result.invitation_sent) {
        // Clear cached status so next check fetches fresh data
        clientStatusCache.delete(client.id);
        toast.success(m.invitation_sent({ email: clientEmail || "" }));
      }
    } catch {
      toast.error(m.error_generic(), { duration: 8000 });
    }

    resendingInvitation = false;
  }
</script>

<div class="space-y-4">
  <!-- Contact Info -->
  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <User class="size-5" />
        {m.contact_info()}
      </Card.Title>
    </Card.Header>
    <Card.Content class="space-y-4">
      <div>
        <p class="text-sm font-medium text-muted-foreground">
          {m.form_name()}
        </p>
        <p class="mt-1">{client.name}</p>
      </div>
      <Separator />
      <div>
        <p class="text-sm font-medium text-muted-foreground">
          {m.form_phone()}
        </p>
        {#if client.phone}
          <p class="mt-1 flex items-center gap-2">
            <Phone class="size-4" />
            {client.phone}
          </p>
        {:else}
          <p class="mt-1 text-muted-foreground">{m.clients_no_phone()}</p>
        {/if}
      </div>
    </Card.Content>
  </Card.Root>

  <!-- Default Location -->
  {#if client.default_pickup_location}
    <Card.Root>
      <Card.Header>
        <Card.Title class="flex items-center gap-2">
          <MapPin class="size-5" />
          {m.default_location()}
        </Card.Title>
      </Card.Header>
      <Card.Content>
        <p>{client.default_pickup_location}</p>
      </Card.Content>
    </Card.Root>
  {/if}

  <!-- Account Info -->
  <Card.Root>
    <Card.Header>
      <Card.Title>{m.account_info()}</Card.Title>
    </Card.Header>
    <Card.Content class="space-y-2">
      <div class="flex justify-between">
        <span class="text-muted-foreground">{m.label_status()}</span>
        <Badge variant={client.active ? "default" : "secondary"}>
          {client.active ? m.status_active() : m.clients_inactive()}
        </Badge>
      </div>
      <div class="flex justify-between">
        <span class="text-muted-foreground">{m.label_member_since()}</span>
        <span>{formatDate(client.created_at)}</span>
      </div>

      {#if !checkingStatus && clientIsConfirmed === false}
        <Separator class="my-3" />
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Mail class="size-4 text-amber-500" />
              <span class="text-sm text-amber-600"
                >{m.invitation_pending()}</span
              >
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            class="w-full"
            onclick={handleResendInvitation}
            disabled={resendingInvitation}
          >
            <Send class="size-4 mr-2" />
            {resendingInvitation ? m.loading() : m.resend_invitation()}
          </Button>
        </div>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
