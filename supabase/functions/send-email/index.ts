import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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

function generateEmailHtml(template: EmailTemplate, data: Record<string, string>): { subject: string; html: string } {
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
        subject: `New Service Request from ${data.client_name}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Service Request</h1>
              </div>
              <div class="content">
                <p>You have a new service request from <strong>${data.client_name}</strong>.</p>
                <div class="detail">
                  <p><span class="label">Pickup:</span> ${data.pickup_location}</p>
                  <p><span class="label">Delivery:</span> ${data.delivery_location}</p>
                  ${data.requested_date ? `<p><span class="label">Requested Date:</span> ${data.requested_date}</p>` : ""}
                  ${data.notes ? `<p><span class="label">Notes:</span> ${data.notes}</p>` : ""}
                </div>
                <a href="${data.app_url}/courier/requests" class="button">View Request</a>
              </div>
              <div class="footer">
                <p>bareCourier - Courier Management</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "delivered":
      return {
        subject: "Your Service Has Been Delivered",
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #16a34a;">
                <h1>Service Delivered</h1>
              </div>
              <div class="content">
                <p>Good news! Your service has been marked as delivered.</p>
                <div class="detail">
                  <p><span class="label">Pickup:</span> ${data.pickup_location}</p>
                  <p><span class="label">Delivery:</span> ${data.delivery_location}</p>
                  <p><span class="label">Delivered:</span> ${data.delivered_at}</p>
                </div>
                <a href="${data.app_url}/client" class="button" style="background: #16a34a;">View My Services</a>
              </div>
              <div class="footer">
                <p>Thank you for using bareCourier!</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_accepted":
      return {
        subject: "Your Service Request Has Been Accepted",
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #16a34a;">
                <h1>Request Accepted</h1>
              </div>
              <div class="content">
                <p>Your service request has been accepted by the courier.</p>
                <div class="detail">
                  <p><span class="label">Pickup:</span> ${data.pickup_location}</p>
                  <p><span class="label">Delivery:</span> ${data.delivery_location}</p>
                  ${data.scheduled_date ? `<p><span class="label">Scheduled:</span> ${data.scheduled_date}</p>` : ""}
                </div>
                <a href="${data.app_url}/client" class="button" style="background: #16a34a;">View My Services</a>
              </div>
              <div class="footer">
                <p>bareCourier - Courier Management</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_rejected":
      return {
        subject: "Service Request Update",
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #dc2626;">
                <h1>Request Not Available</h1>
              </div>
              <div class="content">
                <p>Unfortunately, the courier is unable to fulfill your service request at this time.</p>
                <div class="detail">
                  <p><span class="label">Pickup:</span> ${data.pickup_location}</p>
                  <p><span class="label">Delivery:</span> ${data.delivery_location}</p>
                  ${data.reason ? `<p><span class="label">Reason:</span> ${data.reason}</p>` : ""}
                </div>
                <p>Please create a new request with different dates.</p>
                <a href="${data.app_url}/client/new" class="button">Create New Request</a>
              </div>
              <div class="footer">
                <p>bareCourier - Courier Management</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_suggested":
      return {
        subject: "Alternative Date Suggested for Your Request",
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #f59e0b;">
                <h1>Alternative Suggested</h1>
              </div>
              <div class="content">
                <p>The courier has suggested an alternative date for your service request.</p>
                <div class="detail">
                  <p><span class="label">Pickup:</span> ${data.pickup_location}</p>
                  <p><span class="label">Delivery:</span> ${data.delivery_location}</p>
                  <p><span class="label">Your Request:</span> ${data.requested_date}</p>
                  <p><span class="label">Suggested:</span> ${data.suggested_date}</p>
                </div>
                <p>Please respond to accept or decline this suggestion.</p>
                <a href="${data.app_url}/client" class="button" style="background: #f59e0b;">Respond to Suggestion</a>
              </div>
              <div class="footer">
                <p>bareCourier - Courier Management</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    case "request_cancelled":
      return {
        subject: "Service Request Cancelled",
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header" style="background: #6b7280;">
                <h1>Request Cancelled</h1>
              </div>
              <div class="content">
                <p>A client has cancelled their service request.</p>
                <div class="detail">
                  <p><span class="label">Client:</span> ${data.client_name}</p>
                  <p><span class="label">Pickup:</span> ${data.pickup_location}</p>
                  <p><span class="label">Delivery:</span> ${data.delivery_location}</p>
                </div>
                <a href="${data.app_url}/courier" class="button">View Dashboard</a>
              </div>
              <div class="footer">
                <p>bareCourier - Courier Management</p>
              </div>
            </div>
          </body>
          </html>
        `,
      };

    default:
      return {
        subject: "bareCourier Notification",
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Notification</h1>
              </div>
              <div class="content">
                <p>${data.message || "You have a new notification from bareCourier."}</p>
              </div>
              <div class="footer">
                <p>bareCourier - Courier Management</p>
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

    // Get profile with email notification preference
    const { data: profile } = await adminClient
      .from("profiles")
      .select("email_notifications_enabled")
      .eq("id", user_id)
      .single();

    if (profile && profile.email_notifications_enabled === false) {
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

    // Generate email content
    const { subject, html } = generateEmailHtml(template, templateData || {});

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
