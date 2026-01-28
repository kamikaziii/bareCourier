import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { emailT } from "../_shared/email-translations.ts";
import { getLocale, type SupportedLocale } from "../_shared/translations.ts";

/**
 * Send Email Notification Edge Function
 *
 * Sends email notifications using Resend.
 * Requires secrets configured in Supabase:
 *   - RESEND_API_KEY
 *   - RESEND_FROM_EMAIL (must be from a verified domain, or use noreply@resend.dev for testing)
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

// Email templates
type EmailTemplate = "new_request" | "delivered" | "request_accepted" | "request_rejected" | "request_suggested" | "request_cancelled";

interface EmailData {
  to: string;
  template: EmailTemplate;
  data: Record<string, string>;
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 * All user-provided data must be escaped before HTML interpolation.
 */
function escapeHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function generateEmailHtml(
  template: EmailTemplate,
  rawData: Record<string, string>,
  locale: SupportedLocale = "pt-PT"
): { subject: string; html: string } {
  // Escape all user-provided data to prevent XSS
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawData)) {
    // app_url and locale are trusted internal values, don't escape them
    if (key === "app_url" || key === "locale") {
      data[key] = value;
    } else {
      data[key] = escapeHtml(value);
    }
  }
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
      .container { max-width: 600px; margin: 0 auto; padding: 20px; }
      .header { background: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
      .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
      .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
      .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0; }
      .detail { background: white; padding: 12px; border-radius: 6px; margin: 12px 0; border: 1px solid #e5e7eb; }
      .label { font-weight: 600; color: #374151; }
    </style>
  `;

  switch (template) {
    case "new_request":
      return {
        subject: emailT("email_new_request_subject", locale, { client_name: data.client_name }),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${emailT("email_new_request_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${emailT("email_new_request_intro", locale, { client_name: data.client_name })}</p>
                <div class="detail">
                  <p><span class="label">${emailT("email_pickup_label", locale)}</span> ${data.pickup_location}</p>
                  <p><span class="label">${emailT("email_delivery_label", locale)}</span> ${data.delivery_location}</p>
                  ${data.requested_date ? `<p><span class="label">${emailT("email_new_request_date_label", locale)}</span> ${data.requested_date}</p>` : ""}
                  ${data.notes ? `<p><span class="label">${emailT("email_new_request_notes_label", locale)}</span> ${data.notes}</p>` : ""}
                </div>
                <a href="${data.app_url}/courier/requests" class="button">${emailT("email_new_request_button", locale)}</a>
              </div>
              <div class="footer">
                <p>${emailT("email_footer", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "delivered":
      return {
        subject: emailT("email_delivered_subject", locale),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #16a34a;">
                <h1>${emailT("email_delivered_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${emailT("email_delivered_intro", locale)}</p>
                <div class="detail">
                  <p><span class="label">${emailT("email_pickup_label", locale)}</span> ${data.pickup_location}</p>
                  <p><span class="label">${emailT("email_delivery_label", locale)}</span> ${data.delivery_location}</p>
                  <p><span class="label">${emailT("email_delivered_at_label", locale)}</span> ${data.delivered_at}</p>
                </div>
                <a href="${data.app_url}/client" class="button" style="background: #16a34a;">${emailT("email_delivered_button", locale)}</a>
              </div>
              <div class="footer">
                <p>${emailT("email_delivered_footer", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_accepted":
      return {
        subject: emailT("email_accepted_subject", locale),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #16a34a;">
                <h1>${emailT("email_accepted_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${emailT("email_accepted_intro", locale)}</p>
                <div class="detail">
                  <p><span class="label">${emailT("email_pickup_label", locale)}</span> ${data.pickup_location}</p>
                  <p><span class="label">${emailT("email_delivery_label", locale)}</span> ${data.delivery_location}</p>
                  ${data.scheduled_date ? `<p><span class="label">${emailT("email_accepted_scheduled_label", locale)}</span> ${data.scheduled_date}</p>` : ""}
                </div>
                <a href="${data.app_url}/client" class="button" style="background: #16a34a;">${emailT("email_accepted_button", locale)}</a>
              </div>
              <div class="footer">
                <p>${emailT("email_footer", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_rejected":
      return {
        subject: emailT("email_rejected_subject", locale),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #dc2626;">
                <h1>${emailT("email_rejected_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${emailT("email_rejected_intro", locale)}</p>
                <div class="detail">
                  <p><span class="label">${emailT("email_pickup_label", locale)}</span> ${data.pickup_location}</p>
                  <p><span class="label">${emailT("email_delivery_label", locale)}</span> ${data.delivery_location}</p>
                  ${data.reason ? `<p><span class="label">${emailT("email_rejected_reason_label", locale)}</span> ${data.reason}</p>` : ""}
                </div>
                <p>${emailT("email_rejected_cta", locale)}</p>
                <a href="${data.app_url}/client/new" class="button">${emailT("email_rejected_button", locale)}</a>
              </div>
              <div class="footer">
                <p>${emailT("email_footer", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_suggested":
      return {
        subject: emailT("email_suggested_subject", locale),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #f59e0b;">
                <h1>${emailT("email_suggested_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${emailT("email_suggested_intro", locale)}</p>
                <div class="detail">
                  <p><span class="label">${emailT("email_pickup_label", locale)}</span> ${data.pickup_location}</p>
                  <p><span class="label">${emailT("email_delivery_label", locale)}</span> ${data.delivery_location}</p>
                  <p><span class="label">${emailT("email_suggested_requested_label", locale)}</span> ${data.requested_date}</p>
                  <p><span class="label">${emailT("email_suggested_suggested_label", locale)}</span> ${data.suggested_date}</p>
                </div>
                <p>${emailT("email_suggested_cta", locale)}</p>
                <a href="${data.app_url}/client" class="button" style="background: #f59e0b;">${emailT("email_suggested_button", locale)}</a>
              </div>
              <div class="footer">
                <p>${emailT("email_footer", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_cancelled":
      return {
        subject: emailT("email_cancelled_subject", locale),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #6b7280;">
                <h1>${emailT("email_cancelled_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${emailT("email_cancelled_intro", locale)}</p>
                <div class="detail">
                  <p><span class="label">${emailT("email_cancelled_client_label", locale)}</span> ${data.client_name}</p>
                  <p><span class="label">${emailT("email_pickup_label", locale)}</span> ${data.pickup_location}</p>
                  <p><span class="label">${emailT("email_delivery_label", locale)}</span> ${data.delivery_location}</p>
                </div>
                <a href="${data.app_url}/courier" class="button">${emailT("email_cancelled_button", locale)}</a>
              </div>
              <div class="footer">
                <p>${emailT("email_footer", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    default:
      return {
        subject: emailT("email_default_subject", locale),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${emailT("email_default_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${data.message || emailT("email_default_message", locale)}</p>
              </div>
              <div class="footer">
                <p>${emailT("email_footer", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };
  }
}

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get Resend configuration
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@resend.dev";

    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
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

    // Create Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
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

    // Parse request body
    const { user_id, template, data: templateData } = await req.json() as EmailData & { user_id: string };

    if (!user_id || !template) {
      return new Response(
        JSON.stringify({ error: "user_id and template are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's email and check if email notifications are enabled
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // IDOR Protection: Verify caller has permission to send email to target user
    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // Get target user's profile (role, email notification preference, and locale)
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role, email_notifications_enabled, locale")
      .eq("id", user_id)
      .single();

    const isCourier = callerProfile?.role === "courier";
    const isSelfNotification = user_id === user.id;
    const isNotifyingCourier = targetProfile?.role === "courier";

    // Allow if: caller is courier, OR notifying self, OR client notifying courier
    if (!isCourier && !isSelfNotification && !isNotifyingCourier) {
      return new Response(
        JSON.stringify({ error: "Forbidden: Cannot send emails to other users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if email notifications are enabled for target user
    if (targetProfile && targetProfile.email_notifications_enabled === false) {
      return new Response(
        JSON.stringify({ success: true, sent: false, reason: "Email notifications disabled for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's email from auth
    const { data: { user: targetUser } } = await adminClient.auth.admin.getUserById(user_id);

    if (!targetUser?.email) {
      return new Response(
        JSON.stringify({ error: "User email not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine locale: prefer from templateData (passed by dispatchNotification), fallback to profile
    const locale = getLocale(templateData?.locale || targetProfile?.locale);

    // Generate email content
    const { subject, html } = generateEmailHtml(template, templateData || {}, locale);

    // Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `bareCourier <${resendFromEmail}>`,
        to: [targetUser.email],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      return new Response(
        JSON.stringify({ error: `Resend API error: ${JSON.stringify(errorData)}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        email_id: resendData.id,
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
