import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// NOTE: This function uses verify_jwt: false (set in Supabase Dashboard or config.toml)
//
// Why? Supabase is deprecating the verify_jwt flag in favor of manual JWT validation.
// The old verify_jwt check is incompatible with Supabase's new asymmetric JWT signing keys.
// See: https://supabase.com/docs/guides/functions/auth
//
// We validate the JWT ourselves using getUser() which uses the modern validation path.
// This is Supabase's recommended approach for Edge Functions.

// Allowed origins for CORS
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://barecourier.vercel.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get the authorization header to verify the caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client with user's JWT to check permissions
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller using modern JWT validation (recommended by Supabase)
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify caller is a courier
    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.role !== "courier") {
      return new Response(
        JSON.stringify({ error: "Only couriers can create clients" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse and validate request body
    const { email, password, name, phone, default_pickup_location, default_service_type_id } = await req.json();

    if (!email || !password || !name) {
      return new Response(
        JSON.stringify({ error: "Email, password, and name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create client user with admin API (no confirmation email)
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role: "client" },
    });

    if (authError) {
      return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update profile with additional fields (trigger creates basic profile)
    // Use a retry loop to handle race condition with trigger
    if (authData.user) {
      let retries = 5;
      let updateError = null;

      while (retries > 0) {
        const { error } = await adminClient
          .from("profiles")
          .update({
            phone: phone || null,
            default_pickup_location: default_pickup_location || null,
            default_service_type_id: default_service_type_id || null,
          })
          .eq("id", authData.user.id);

        if (!error) {
          break; // Success!
        }

        updateError = error;

        // Wait 100ms before retrying (give trigger time to complete)
        await new Promise(resolve => setTimeout(resolve, 100));
        retries--;
      }

      if (updateError) {
        console.error("Profile update error after retries:", updateError);
        // Return error to caller so they know something went wrong
        return new Response(
          JSON.stringify({
            error: "Client created but profile update failed. Please edit the client to add missing details.",
            user: { id: authData.user.id, email: authData.user.email }
          }),
          { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: authData.user?.id, email: authData.user?.email }
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
