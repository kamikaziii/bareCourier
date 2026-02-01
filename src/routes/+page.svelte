<script lang="ts">
  import * as m from "$lib/paraglide/messages.js";
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
  <div class="text-center">
    <h1 class="text-4xl font-bold text-foreground">{m.app_name()}</h1>
    <p class="mt-2 text-muted-foreground">{m.redirecting()}</p>
  </div>
</div>
