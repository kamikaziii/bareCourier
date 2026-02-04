import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isServiceRoleKey } from "../_shared/auth.ts";
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

// Email templates
type EmailTemplate = "new_request" | "delivered" | "request_accepted" | "request_rejected" | "request_suggested" | "request_cancelled" | "daily_summary" | "past_due" | "suggestion_accepted" | "suggestion_declined";

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

/**
 * Checks if a 429 error is a retryable rate limit vs non-retryable quota error.
 * Resend returns 429 for: rate_limit_exceeded (retry), daily_quota_exceeded (don't retry),
 * monthly_quota_exceeded (don't retry - needs plan upgrade).
 */
async function isRetryableRateLimit(response: Response): Promise<{ retryable: boolean; errorName?: string }> {
  try {
    const cloned = response.clone();
    const body = await cloned.json();
    const errorName = body?.name || "unknown";
    // Only rate_limit_exceeded is retryable; quota errors are not
    return { retryable: errorName === "rate_limit_exceeded", errorName };
  } catch {
    // If we can't parse body, assume retryable (safer for transient issues)
    return { retryable: true, errorName: "parse_error" };
  }
}

/**
 * Fetches with automatic retry for rate limits (429) and transient errors (5xx).
 * Uses exponential backoff with jitter to prevent thundering herd.
 *
 * Retry behavior:
 * - 429 rate_limit_exceeded: Retry with backoff
 * - 429 daily/monthly_quota_exceeded: Fail immediately (not transient)
 * - 5xx: Retry with backoff
 * - 4xx (except 429): Fail immediately (permanent error)
 * - Network/timeout errors: Retry with backoff
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3,
  timeoutMs = 30000
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Success - return immediately
      if (response.ok) {
        return response;
      }

      // Permanent 4xx errors (except 429) - fail immediately
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return response;
      }

      // 429 - check if it's retryable rate limit or permanent quota error
      if (response.status === 429) {
        const { retryable, errorName } = await isRetryableRateLimit(response);
        if (!retryable) {
          console.log(`[send-email] Quota exceeded (${errorName}), not retrying`);
          return response;
        }
        // Fall through to retry logic
      }

      // Retry on 429 (rate_limit_exceeded) or 5xx
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get("retry-after");
        const parsedRetryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : NaN;
        const baseDelay = !isNaN(parsedRetryAfter)
          ? parsedRetryAfter * 1000
          : Math.pow(2, attempt) * 500; // 500ms, 1s, 2s

        const jitter = Math.random() * 300;
        const delay = baseDelay + jitter;

        console.log(
          `[send-email] Retry ${attempt + 1}/${maxRetries} after ${response.status}, waiting ${Math.round(delay)}ms`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Last attempt or non-retryable - return as-is
      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      const errorName = (error as Error).name;
      if (errorName === "AbortError") {
        console.log(`[send-email] Request timeout (attempt ${attempt + 1}/${maxRetries + 1})`);
      }

      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 500 + Math.random() * 300;
        console.log(`[send-email] Retry ${attempt + 1}/${maxRetries} after ${errorName}, waiting ${Math.round(delay)}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  // This should be unreachable, but TypeScript needs it
  throw new Error("[send-email] fetchWithRetry: unexpected code path");
}

// Email template wrapper configuration
interface EmailWrapOptions {
  headerColor: string;
  title: string;
  content: string;
  button?: { text: string; href: string; color?: string };
  footer?: string;
}

// Base styles for all emails - single source of truth
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

// Common color constants for email headers
const colors = {
  primary: "#2563eb",
  success: "#16a34a",
  danger: "#dc2626",
  warning: "#f59e0b",
  muted: "#6b7280",
};

/**
 * Wraps email content in the standard HTML template.
 * Single source of truth for email structure and styling.
 */
function wrapEmail(options: EmailWrapOptions): string {
  const { headerColor, title, content, button, footer } = options;
  const buttonHtml = button
    ? `<a href="${button.href}" class="button" style="background: ${button.color || headerColor};">${button.text}</a>`
    : "";

  return `<!DOCTYPE html>
<html>
<head>${baseStyles}</head>
<body>
  <div class="container">
    <div class="header" style="background: ${headerColor};">
      <h1>${title}</h1>
    </div>
    <div class="content">
      ${content}
      ${buttonHtml}
    </div>
    <div class="footer">
      <p>${footer}</p>
    </div>
  </div>
</body>
</html>`;
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

  // Helper to build detail rows (returns empty string for undefined values)
  const detailRow = (label: string, value: string | undefined, labelStyle?: string) =>
    value ? `<p><span class="label"${labelStyle ? ` style="${labelStyle}"` : ""}>${label}</span> ${value}</p>` : "";

  // Common detail block for pickup/delivery locations
  const locationDetails = () => `
    ${detailRow(emailT("email_pickup_label", locale), data.pickup_location)}
    ${detailRow(emailT("email_delivery_label", locale), data.delivery_location)}
  `;

  // Common footer
  const defaultFooter = emailT("email_footer", locale);

  switch (template) {
    case "new_request":
      return {
        subject: emailT("email_new_request_subject", locale, { client_name: data.client_name }),
        html: wrapEmail({
          headerColor: colors.primary,
          title: emailT("email_new_request_title", locale),
          content: `
            <p>${emailT("email_new_request_intro", locale, { client_name: data.client_name })}</p>
            <div class="detail">
              ${locationDetails()}
              ${detailRow(emailT("email_new_request_date_label", locale), data.requested_date)}
              ${detailRow(emailT("email_new_request_notes_label", locale), data.notes)}
            </div>
          `,
          button: {
            text: emailT("email_new_request_button", locale),
            href: `${data.app_url}/courier/requests`,
          },
          footer: defaultFooter,
        }),
      };

    case "delivered":
      return {
        subject: emailT("email_delivered_subject", locale),
        html: wrapEmail({
          headerColor: colors.success,
          title: emailT("email_delivered_title", locale),
          content: `
            <p>${emailT("email_delivered_intro", locale)}</p>
            <div class="detail">
              ${locationDetails()}
              ${detailRow(emailT("email_delivered_at_label", locale), data.delivered_at)}
            </div>
          `,
          button: {
            text: emailT("email_delivered_button", locale),
            href: `${data.app_url}/client`,
            color: colors.success,
          },
          footer: emailT("email_delivered_footer", locale),
        }),
      };

    case "request_accepted":
      return {
        subject: emailT("email_accepted_subject", locale),
        html: wrapEmail({
          headerColor: colors.success,
          title: emailT("email_accepted_title", locale),
          content: `
            <p>${emailT("email_accepted_intro", locale)}</p>
            <div class="detail">
              ${locationDetails()}
              ${detailRow(emailT("email_accepted_scheduled_label", locale), data.scheduled_date)}
            </div>
          `,
          button: {
            text: emailT("email_accepted_button", locale),
            href: `${data.app_url}/client`,
            color: colors.success,
          },
          footer: defaultFooter,
        }),
      };

    case "request_rejected":
      return {
        subject: emailT("email_rejected_subject", locale),
        html: wrapEmail({
          headerColor: colors.danger,
          title: emailT("email_rejected_title", locale),
          content: `
            <p>${emailT("email_rejected_intro", locale)}</p>
            <div class="detail">
              ${locationDetails()}
              ${detailRow(emailT("email_rejected_reason_label", locale), data.reason)}
            </div>
            <p>${emailT("email_rejected_cta", locale)}</p>
          `,
          button: {
            text: emailT("email_rejected_button", locale),
            href: `${data.app_url}/client/new`,
          },
          footer: defaultFooter,
        }),
      };

    case "request_suggested":
      return {
        subject: emailT("email_suggested_subject", locale),
        html: wrapEmail({
          headerColor: colors.warning,
          title: emailT("email_suggested_title", locale),
          content: `
            <p>${emailT("email_suggested_intro", locale)}</p>
            <div class="detail">
              ${locationDetails()}
              ${detailRow(emailT("email_suggested_requested_label", locale), data.requested_date)}
              ${detailRow(emailT("email_suggested_suggested_label", locale), data.suggested_date)}
            </div>
            <p>${emailT("email_suggested_cta", locale)}</p>
          `,
          button: {
            text: emailT("email_suggested_button", locale),
            href: `${data.app_url}/client`,
            color: colors.warning,
          },
          footer: defaultFooter,
        }),
      };

    case "request_cancelled":
      return {
        subject: emailT("email_cancelled_subject", locale),
        html: wrapEmail({
          headerColor: colors.muted,
          title: emailT("email_cancelled_title", locale),
          content: `
            <p>${emailT("email_cancelled_intro", locale)}</p>
            <div class="detail">
              ${detailRow(emailT("email_cancelled_client_label", locale), data.client_name)}
              ${locationDetails()}
            </div>
          `,
          button: {
            text: emailT("email_cancelled_button", locale),
            href: `${data.app_url}/courier`,
          },
          footer: defaultFooter,
        }),
      };

    case "daily_summary": {
      // Daily summary has conditional content based on whether there are services
      const summaryContent = data.total === "0"
        ? `<p>${emailT("email_daily_summary_no_services", locale)}</p>`
        : `
          <div class="detail">
            ${detailRow(emailT("email_daily_summary_total_label", locale), data.total)}
            ${detailRow(emailT("email_daily_summary_pending_label", locale), data.pending)}
            ${detailRow(emailT("email_daily_summary_delivered_label", locale), data.delivered)}
            ${data.urgent && data.urgent !== "0" ? detailRow(emailT("email_daily_summary_urgent_label", locale), data.urgent, "color: #dc2626;") : ""}
          </div>
        `;

      return {
        subject: emailT("email_daily_summary_subject", locale, { date: data.date }),
        html: wrapEmail({
          headerColor: colors.primary,
          title: emailT("email_daily_summary_title", locale),
          content: `
            <p>${emailT("email_daily_summary_intro", locale)}</p>
            ${summaryContent}
          `,
          button: {
            text: emailT("email_daily_summary_button", locale),
            href: `${data.app_url}/courier`,
          },
          footer: defaultFooter,
        }),
      };
    }

    case "past_due":
      return {
        subject: emailT("email_past_due_subject", locale),
        html: wrapEmail({
          headerColor: colors.danger,
          title: emailT("email_past_due_title", locale),
          content: `
            <p>${emailT("email_past_due_intro", locale)}</p>
            <div class="detail">
              ${detailRow(emailT("email_past_due_client_label", locale), data.client_name)}
              ${locationDetails()}
              ${detailRow(emailT("email_past_due_scheduled_label", locale), data.scheduled_date)}
              ${detailRow(emailT("email_past_due_days_overdue_label", locale), data.days_overdue, "color: #dc2626;")}
            </div>
          `,
          button: {
            text: emailT("email_past_due_button", locale),
            href: `${data.app_url}/courier/services/${data.service_id}`,
            color: colors.danger,
          },
          footer: defaultFooter,
        }),
      };

    case "suggestion_accepted":
      return {
        subject: emailT("email_suggestion_accepted_subject", locale),
        html: wrapEmail({
          headerColor: colors.success,
          title: emailT("email_suggestion_accepted_title", locale),
          content: `
            <p>${emailT("email_suggestion_accepted_intro", locale, { client_name: data.client_name })}</p>
            <div class="detail">
              ${locationDetails()}
              ${detailRow(emailT("email_suggestion_accepted_new_date_label", locale), data.new_date)}
            </div>
          `,
          button: {
            text: emailT("email_suggestion_accepted_button", locale),
            href: `${data.app_url}/courier/services/${data.service_id}`,
            color: colors.success,
          },
          footer: defaultFooter,
        }),
      };

    case "suggestion_declined":
      return {
        subject: emailT("email_suggestion_declined_subject", locale),
        html: wrapEmail({
          headerColor: colors.warning,
          title: emailT("email_suggestion_declined_title", locale),
          content: `
            <p>${emailT("email_suggestion_declined_intro", locale, { client_name: data.client_name })}</p>
            <div class="detail">
              ${locationDetails()}
              ${detailRow(emailT("email_suggestion_declined_reason_label", locale), data.reason)}
              ${detailRow(emailT("email_suggestion_declined_original_date_label", locale), data.original_date)}
            </div>
            <p>${emailT("email_suggestion_declined_cta", locale)}</p>
          `,
          button: {
            text: emailT("email_suggestion_declined_button", locale),
            href: `${data.app_url}/courier/services/${data.service_id}`,
            color: colors.warning,
          },
          footer: defaultFooter,
        }),
      };

    default:
      return {
        subject: emailT("email_default_subject", locale),
        html: wrapEmail({
          headerColor: colors.primary,
          title: emailT("email_default_title", locale),
          content: `<p>${data.message || emailT("email_default_message", locale)}</p>`,
          footer: defaultFooter,
        }),
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
      // User token - verify using getClaims() (faster, no network round-trip)
      // https://supabase.com/docs/guides/functions/auth
      const token = authHeader.replace('Bearer ', '');
      const supabase = createClient(supabaseUrl, supabaseAnonKey);

      const { data, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !data?.claims?.sub) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired session" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = data.claims.sub as string;
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

    // Get target user's profile (role, email notification preference, and locale)
    const { data: targetProfile } = await adminClient
      .from("profiles")
      .select("role, email_notifications_enabled, locale")
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
          JSON.stringify({ error: "Forbidden: Cannot send emails to other users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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

    // Send email via Resend with automatic retry for transient errors
    const resendResponse = await fetchWithRetry("https://api.resend.com/emails", {
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

    // Log successful email delivery for observability
    console.log(`[send-email] Email sent successfully to ${targetUser.email}, id: ${resendData.id}`);

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
