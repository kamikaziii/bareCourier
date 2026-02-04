import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireCourier } from "../_shared/auth.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";

// NOTE: This function uses verify_jwt: false (set in Supabase Dashboard or config.toml)
// We validate the JWT ourselves using getUser() which uses the modern validation path.

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
    const { supabaseAdmin: adminClient, supabaseUser: userClient } = auth.context;

    // Parse and validate request body
    const { client_id, new_password } = await req.json();

    if (!client_id || !new_password) {
      return new Response(
        JSON.stringify({ error: "Client ID and new password are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new_password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the target is a client (not the courier themselves or another courier)
    const { data: targetProfile, error: targetError } = await userClient
      .from("profiles")
      .select("id, role")
      .eq("id", client_id)
      .single();

    if (targetError || !targetProfile) {
      return new Response(
        JSON.stringify({ error: "Client not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetProfile.role !== "client") {
      return new Response(
        JSON.stringify({ error: "Can only reset passwords for clients" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reset password using admin API
    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      client_id,
      { password: new_password }
    );

    if (updateError) {
      return new Response(
        JSON.stringify({ error: mapErrorToUserMessage(updateError, 'reset-client-password') }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log full error server-side for debugging, return generic message to client
    console.error('[reset-client-password] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
