import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireCourier } from "../_shared/auth.ts";

/**
 * Check Client Status Edge Function
 *
 * Returns the email confirmation status for a client.
 * Used to determine if "Resend Invitation" button should be shown.
 */


Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate caller as courier
    const auth = await requireCourier(req);
    if (!auth.success) {
      return auth.response;
    }
    const { supabaseAdmin: adminClient } = auth.context;

    // Parse request body
    const { client_id } = await req.json();

    if (!client_id) {
      return new Response(
        JSON.stringify({ error: "client_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use admin client to check user's email confirmation status
    const { data: { user: clientUser }, error: clientError } = await adminClient.auth.admin.getUserById(client_id);

    if (clientError || !clientUser) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the target user is actually a client (prevents IDOR)
    const { data: clientProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", client_id)
      .single();

    if (!clientProfile || clientProfile.role !== "client") {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        client_id: clientUser.id,
        email: clientUser.email,
        email_confirmed_at: clientUser.email_confirmed_at,
        is_confirmed: !!clientUser.email_confirmed_at,
        created_at: clientUser.created_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log full error server-side for debugging, return generic message to client
    console.error('[check-client-status] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
