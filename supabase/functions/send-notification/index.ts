import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { dispatchNotification, type NotificationCategory } from "../_shared/notify.ts";

/**
 * Unified Notification Dispatch Edge Function
 *
 * Wraps dispatchNotification() to provide a single endpoint for server actions
 * to send multi-channel notifications (in-app + push + email).
 *
 * This function centralizes notification logic and respects user preferences:
 * - Quiet hours
 * - Working days
 * - Per-category channel preferences (in-app, push, email)
 *
 * Required Supabase secrets (delegated to send-push and send-email):
 *   - VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (for push)
 *   - RESEND_API_KEY, RESEND_FROM_EMAIL (for email)
 */

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

interface NotificationRequest {
  user_id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  service_id?: string;
  email_template?: string;
  email_data?: Record<string, string>;
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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
      // Service role key - trusted internal call (e.g., from cron jobs)
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
    const {
      user_id,
      category,
      title,
      message,
      service_id,
      email_template,
      email_data,
    } = await req.json() as NotificationRequest;

    // Validate required fields
    if (!user_id || !category || !title || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, category, title, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate category
    const validCategories: NotificationCategory[] = [
      "new_request",
      "schedule_change",
      "past_due",
      "daily_summary",
      "service_status",
    ];
    if (!validCategories.includes(category)) {
      return new Response(
        JSON.stringify({ error: `Invalid category. Must be one of: ${validCategories.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create admin client for dispatchNotification
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // IDOR Protection (unless service role)
    if (!isServiceRole) {
      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("role")
        .eq("id", user_id)
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

    // Dispatch notification via shared helper
    const result = await dispatchNotification({
      supabase: adminClient,
      userId: user_id,
      category,
      title,
      message,
      serviceId: service_id,
      emailTemplate: email_template,
      emailData: email_data,
    });

    return new Response(
      JSON.stringify({
        success: true,
        ...result,
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
