import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import webpush from "npm:web-push@3.6.7";

/**
 * Send Push Notification Edge Function
 *
 * Sends push notifications to all subscribed devices for a user.
 * Uses the web-push library for proper ECDH encryption and VAPID signing.
 *
 * Required Supabase secrets:
 *   - VAPID_PUBLIC_KEY
 *   - VAPID_PRIVATE_KEY
 *   - VAPID_SUBJECT (e.g., mailto:admin@barecourier.com)
 */

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

/**
 * Timing-safe comparison for service role key authentication.
 * Prevents timing attacks that could leak key information.
 */
function isServiceRoleKey(authHeader: string, serviceKey: string): boolean {
  const bearerToken = authHeader.replace('Bearer ', '');
  if (bearerToken.length !== serviceKey.length) return false;

  return timingSafeEqual(
    Buffer.from(bearerToken),
    Buffer.from(serviceKey)
  );
}

// Configure VAPID once at startup
let vapidConfigured = false;

function configureVapid() {
  if (vapidConfigured) return true;

  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@barecourier.com";

  if (!vapidPublicKey || !vapidPrivateKey) {
    return false;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  vapidConfigured = true;
  return true;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Configure VAPID keys
    if (!configureVapid()) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Determine if caller is using service role key or user token (timing-safe comparison)
    const isServiceRole = isServiceRoleKey(authHeader, supabaseServiceKey);

    let userId: string | null = null;

    if (isServiceRole) {
      // Service role key - trusted internal call (e.g., from notify.ts, cron jobs)
      // Skip user verification
      userId = "service-role";
    } else {
      // User token - verify authentication
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = user.id;
    }

    // Parse request body
    const { user_id, title, message, url, service_id } = await req.json();

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Admin client for database operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get target user's profile (role and push notification preference)
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role, push_notifications_enabled")
      .eq("id", user_id)
      .single();

    // IDOR Protection (skip for service role - trusted internal calls)
    if (!isServiceRole) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      const isCourier = callerProfile?.role === "courier";
      const isSelfNotification = user_id === userId;
      const isNotifyingCourier = targetProfile?.role === "courier";

      // Allow if: caller is courier, OR notifying self, OR client notifying courier
      if (!isCourier && !isSelfNotification && !isNotifyingCourier) {
        return new Response(
          JSON.stringify({ error: "Forbidden: Cannot send notifications to other users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Check if user has push notifications enabled
    if (targetProfile && targetProfile.push_notifications_enabled === false) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "Push notifications disabled for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all push subscriptions for the user
    const { data: subscriptions, error: subError } = await adminClient
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      return new Response(
        JSON.stringify({ error: subError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, reason: "No subscriptions found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the notification payload
    const payload = JSON.stringify({ title, message, url, service_id });

    // Send push to all subscriptions using web-push library
    const results = await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          // Build the PushSubscription object expected by web-push
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          // sendNotification handles all encryption and VAPID signing automatically
          await webpush.sendNotification(pushSubscription, payload, {
            TTL: 86400, // 24 hours in seconds
            urgency: "normal" as const,
          });

          return { success: true, id: sub.id };
        } catch (error) {
          const statusCode = (error as { statusCode?: number }).statusCode;
          return {
            success: false,
            id: sub.id,
            statusCode,
            error: (error as Error).message,
          };
        }
      })
    );

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    // Clean up expired/invalid subscriptions (410 Gone or 404 Not Found)
    for (const result of failed) {
      if (result.statusCode === 410 || result.statusCode === 404) {
        await adminClient
          .from("push_subscriptions")
          .delete()
          .eq("id", result.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed: failed.length,
        errors: failed.map((f) => f.error),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
