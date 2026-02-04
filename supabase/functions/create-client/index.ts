import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireCourier } from "../_shared/auth.ts";
import { mapErrorToUserMessage } from "../_shared/errors.ts";

// ============================================================================
// Rate Limiting (In-Memory)
// ============================================================================
// NOTE: This is an in-memory rate limit that resets on function cold start.
// For production-grade rate limiting, consider using a database table.
// This provides immediate protection against basic abuse.

const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour in milliseconds

/**
 * Checks if an email address is rate limited.
 * Returns true if an invitation was sent to this email within the rate limit window.
 */
function isRateLimited(email: string): boolean {
  const normalizedEmail = email.toLowerCase();
  const lastSent = rateLimitMap.get(normalizedEmail);
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  return false;
}

/**
 * Records that an invitation email was sent to the given address.
 */
function recordEmailSent(email: string): void {
  rateLimitMap.set(email.toLowerCase(), Date.now());
}

/**
 * Sends a client invitation email via the send-email Edge Function.
 * Fetches the courier's name for personalization before sending.
 */
async function sendInvitationEmail(params: {
  adminClient: SupabaseClient;
  supabaseUrl: string;
  serviceKey: string;
  recipientUserId: string;
  courierUserId: string;
  actionLink: string;
  clientName: string;
  siteUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  // Fetch courier name for personalized email
  const { data: courierProfile } = await params.adminClient
    .from("profiles")
    .select("name")
    .eq("id", params.courierUserId)
    .single();

  const response = await fetch(`${params.supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: params.recipientUserId,
      template: "client_invitation",
      data: {
        action_link: params.actionLink,
        client_name: params.clientName,
        courier_name: courierProfile?.name || "Your courier",
        app_url: params.siteUrl,
      },
    }),
  });

  return response.ok
    ? { success: true }
    : { success: false, error: "Failed to send invitation email" };
}

// NOTE: This function uses verify_jwt: false (set in Supabase Dashboard or config.toml)
//
// Why? Supabase is deprecating the verify_jwt flag in favor of manual JWT validation.
// The old verify_jwt check is incompatible with Supabase's new asymmetric JWT signing keys.
// See: https://supabase.com/docs/guides/functions/auth
//
// We validate the JWT ourselves using getUser() which uses the modern validation path.
// This is Supabase's recommended approach for Edge Functions.

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
    const { user, supabaseAdmin: adminClient } = auth.context;

    // Get environment variables needed for email sending
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Parse and validate request body
    const { email, password, name, phone, default_pickup_location, default_pickup_lat, default_pickup_lng, default_service_type_id, send_invitation } = await req.json();

    if (!email || !name) {
      return new Response(
        JSON.stringify({ error: "Email and name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get site URL for redirect
    const siteUrl = Deno.env.get("SITE_URL") || "https://barecourier.vercel.app";

    let authData: { user: { id: string; email: string | undefined } | null } = { user: null };
    let invitationSent = false;
    let isResend = false;

    if (send_invitation) {
      // === INVITATION FLOW ===

      // Rate limit check: prevent spam/abuse
      if (isRateLimited(email)) {
        return new Response(
          JSON.stringify({ error: "Please wait before sending another invitation to this email" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check if user already exists using O(1) indexed lookup (not O(n) listUsers scan)
      // Note: getUserByEmail returns { data: { user: User | null } } matching getUserById pattern
      const { data: existingUserData } = await adminClient.auth.admin.getUserByEmail(email);
      const existingUser = existingUserData?.user;

      if (existingUser) {
        if (existingUser.email_confirmed_at) {
          // User already confirmed - can't resend invite
          return new Response(
            JSON.stringify({ error: "This email is already registered" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // User exists but unconfirmed - regenerate invite link (resend case)
        isResend = true;
        const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
          type: "invite",
          email,
          options: {
            redirectTo: `${siteUrl}/accept-invite`,
          }
        });

        if (linkError) {
          return new Response(
            JSON.stringify({ error: mapErrorToUserMessage(linkError, 'create-client:resend-invite') }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get existing client's name from profile
        const { data: clientProfile } = await adminClient
          .from("profiles")
          .select("name")
          .eq("id", existingUser.id)
          .single();

        // Send invitation email
        const emailResult = await sendInvitationEmail({
          adminClient,
          supabaseUrl,
          serviceKey: supabaseServiceKey,
          recipientUserId: existingUser.id,
          courierUserId: user.id,
          actionLink: linkData.properties.action_link,
          clientName: clientProfile?.name || name,
          siteUrl,
        });

        if (!emailResult.success) {
          return new Response(
            JSON.stringify({ error: emailResult.error }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Record successful send for rate limiting
        recordEmailSent(email);

        return new Response(
          JSON.stringify({
            success: true,
            user: { id: existingUser.id, email },
            invitation_sent: true,
            resend: true
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // New user - generate invite link
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email,
        options: {
          redirectTo: `${siteUrl}/accept-invite`,
          data: {
            role: "client",
            name: name || "",
            phone: phone || null,
          }
        }
      });

      if (linkError) {
        return new Response(
          JSON.stringify({ error: mapErrorToUserMessage(linkError, 'create-client:generate-invite') }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      authData = { user: linkData.user ? { id: linkData.user.id, email: linkData.user.email } : null };
      invitationSent = true;

      // Guard against null user from generateLink
      if (!linkData.user) {
        return new Response(
          JSON.stringify({ error: "Failed to create user invitation" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Send invitation email
      const emailResult = await sendInvitationEmail({
        adminClient,
        supabaseUrl,
        serviceKey: supabaseServiceKey,
        recipientUserId: linkData.user.id,
        courierUserId: user.id,
        actionLink: linkData.properties.action_link,
        clientName: name,
        siteUrl,
      });

      if (!emailResult.success) {
        return new Response(
          JSON.stringify({ error: emailResult.error }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record successful send for rate limiting
      recordEmailSent(email);

    } else {
      // === PASSWORD FLOW (existing behavior) ===
      if (!password) {
        return new Response(
          JSON.stringify({ error: "Password required when not sending invitation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: createData, error: authError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role: "client" },
      });

      if (authError) {
        return new Response(
          JSON.stringify({ error: mapErrorToUserMessage(authError, 'create-client:create-user') }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      authData = { user: createData.user ? { id: createData.user.id, email: createData.user.email } : null };
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
            default_pickup_lat: default_pickup_lat ?? null,
            default_pickup_lng: default_pickup_lng ?? null,
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
            user: { id: authData.user.id, email: authData.user.email },
            invitation_sent: invitationSent
          }),
          { status: 207, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: authData.user?.id, email: authData.user?.email },
        invitation_sent: invitationSent,
        resend: isResend
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    // Log the full error server-side for debugging
    console.error('[create-client] Unhandled error:', error);
    // Return generic message to client - never expose internal details
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
