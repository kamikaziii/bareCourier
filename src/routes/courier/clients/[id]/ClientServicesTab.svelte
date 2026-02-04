<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import * as m from "$lib/paraglide/messages.js";
  import { localizeHref } from "$lib/paraglide/runtime.js";
  import { formatDate } from "$lib/utils.js";
  import { ChevronLeft, ChevronRight } from "@lucide/svelte";
  import type { Service } from "$lib/database.types";

  let {
    services,
    clientId,
    pagination,
  }: {
    services: Service[];
    clientId: string;
    pagination: {
      page: number;
      totalPages: number;
      pageSize: number;
      totalCount: number;
    };
  } = $props();
</script>

<div class="space-y-3">
  {#if services.length === 0}
    <Card.Root>
      <Card.Content class="py-8 text-center text-muted-foreground">
        {m.client_no_services()}
      </Card.Content>
    </Card.Root>
  {:else}
    {#each services as service (service.id)}
      <a href={localizeHref(`/courier/services/${service.id}`)} class="block">
        <Card.Root class="transition-colors hover:bg-muted/50">
          <Card.Content class="flex items-start gap-4 p-4">
            <div
              class="mt-1 size-3 shrink-0 rounded-full {service.status ===
              'pending'
                ? 'bg-blue-500'
                : 'bg-green-500'}"
            ></div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center justify-between gap-2">
                <p class="text-sm text-muted-foreground truncate">
                  {service.pickup_location} &rarr; {service.delivery_location}
                </p>
                <Badge
                  variant="outline"
                  class={service.status === "pending"
                    ? "border-blue-500 text-blue-500"
                    : "border-green-500 text-green-500"}
                >
                  {service.status === "pending"
                    ? m.status_pending()
                    : m.status_delivered()}
                </Badge>
              </div>
              <p class="mt-1 text-xs text-muted-foreground">
                {formatDate(service.created_at)}
                {#if service.notes}
                  &middot; {service.notes}
                {/if}
              </p>
            </div>
          </Card.Content>
        </Card.Root>
      </a>
    {/each}
  {/if}

  {#if pagination.totalPages > 1}
    <div class="flex items-center justify-between pt-4">
      <Button
        variant="outline"
        size="sm"
        disabled={pagination.page <= 1}
        href={localizeHref(
          `/courier/clients/${clientId}?page=${pagination.page - 1}`,
        )}
      >
        <ChevronLeft class="size-4 mr-1" />
        {m.pagination_previous()}
      </Button>
      <span class="text-sm text-muted-foreground">
        {m.pagination_page_of({
          current: pagination.page.toString(),
          total: pagination.totalPages.toString(),
        })}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={pagination.page >= pagination.totalPages}
        href={localizeHref(
          `/courier/clients/${clientId}?page=${pagination.page + 1}`,
        )}
      >
        {m.pagination_next()}
        <ChevronRight class="size-4 ml-1" />
      </Button>
    </div>
  {/if}
</div>
