import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isServiceRoleKey } from "../_shared/auth.ts";
import { emailT } from "../_shared/email-translations.ts";
import { getLocale, type SupportedLocale } from "../_shared/translations.ts";
import { fetchWithRetry, type ShouldRetryCallback } from "../_shared/http/index.ts";

interface ResendErrorResponse {
  name?: string;
  message?: string;
  statusCode?: number;
}

interface ResendSuccessResponse {
  id: string;
}

/**
 * Structured error codes for machine-parseable error responses.
 * Used by automated callers (agents, cron jobs) to handle errors appropriately.
 */
type ErrorCode =
  | "CONFIG_ERROR"
  | "AUTH_ERROR"
  | "VALIDATION_ERROR"
  | "USER_NOT_FOUND"
  | "FORBIDDEN"
  | "NOTIFICATIONS_DISABLED"
  | "RATE_LIMIT"
  | "QUOTA_EXCEEDED"
  | "API_ERROR"
  | "TIMEOUT_ERROR"
  | "INTERNAL_ERROR";

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    retryable: boolean;
    retryAfterMs?: number;
  };
}


/**
 * Send Email Notification Edge Function
 *
 * Sends email notifications using Resend.
 * Requires secrets configured in Supabase:
 *   - RESEND_API_KEY
 *   - RESEND_FROM_EMAIL (must be from a verified domain, or use noreply@resend.dev for testing)
 */

/**
 * Creates a structured error response with machine-parseable error codes.
 * Enables automated callers to handle errors based on code and retryable flag.
 */
function createErrorResponse(
  code: ErrorCode,
  message: string,
  status: number,
  corsHeaders: Record<string, string>,
  retryable: boolean = false,
  retryAfterMs?: number
): Response {
  const body: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      retryable,
      ...(retryAfterMs !== undefined && { retryAfterMs })
    }
  };
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// Email templates
type EmailTemplate = "new_request" | "delivered" | "request_accepted" | "request_rejected" | "request_suggested" | "request_cancelled" | "daily_summary" | "past_due" | "suggestion_accepted" | "suggestion_declined" | "client_invitation";

// Required fields for each email template - validates templateData before sending
const TEMPLATE_REQUIRED_FIELDS: Record<EmailTemplate, string[]> = {
  new_request: ["client_name", "pickup_location", "delivery_location", "app_url"],
  delivered: ["pickup_location", "delivery_location", "delivered_at", "app_url"],
  request_accepted: ["pickup_location", "delivery_location", "app_url"],
  request_rejected: ["pickup_location", "delivery_location", "app_url"],
  request_suggested: ["pickup_location", "delivery_location", "requested_date", "suggested_date", "app_url"],
  request_cancelled: ["client_name", "pickup_location", "delivery_location", "app_url"],
  daily_summary: ["date", "app_url"],
  past_due: ["client_name", "pickup_location", "delivery_location", "scheduled_date", "days_overdue", "app_url"],
  suggestion_accepted: ["client_name", "pickup_location", "delivery_location", "confirmed_date", "app_url"],
  suggestion_declined: ["client_name", "pickup_location", "delivery_location", "original_date", "app_url"],
  client_invitation: ["client_name", "courier_name", "confirmation_url"],
};

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
 * Resend-specific: Checks if a 429 error is a retryable rate limit vs non-retryable quota error.
 * Resend returns 429 for: rate_limit_exceeded (retry), daily_quota_exceeded (don't retry),
 * monthly_quota_exceeded (don't retry - needs plan upgrade).
 *
 * Implements ShouldRetryCallback interface from shared http module.
 *
 * @param response - The HTTP response with status 429
 * @returns Promise resolving to true if retry should be attempted
 */
const shouldRetryResend: ShouldRetryCallback = async (response: Response): Promise<boolean> => {
  try {
    // Clone to preserve body for main handler if we return this response
    const cloned = response.clone();
    const body = (await cloned.json()) as ResendErrorResponse;
    const errorName = body?.name ?? "unknown";
    // Only rate_limit_exceeded is retryable; quota errors are not
    const retryable = errorName === "rate_limit_exceeded";
    if (!retryable) {
      console.log(`[send-email] Quota exceeded (${errorName}), not retrying`);
    }
    return retryable;
  } catch (error) {
    console.warn(
      '[send-email] Failed to parse rate limit response:',
      error instanceof Error ? error.message : String(error)
    );
    // Assume retryable on parse error (safer for transient issues)
    return true;
  }
};

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

/**
 * Validates that an action URL is from a trusted domain.
 * Defense-in-depth: even though action_link comes from Supabase,
 * we validate to prevent injection attacks if the source is ever compromised.
 */
function isValidActionUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Allow http for localhost (development), require https for production
    const isLocalhost = parsed.hostname === 'localhost';
    const isValidProtocol = isLocalhost
      ? (parsed.protocol === 'http:' || parsed.protocol === 'https:')
      : parsed.protocol === 'https:';

    return isValidProtocol &&
           (parsed.hostname.endsWith('supabase.co') ||
            parsed.hostname === 'barecourier.vercel.app' ||
            (parsed.hostname.endsWith('.vercel.app') && parsed.hostname.includes('barecourier')) ||
            isLocalhost);
  } catch {
    return false;
  }
}

function generateEmailHtml(
  template: EmailTemplate,
  rawData: Record<string, string>,
  locale: SupportedLocale = "pt-PT"
): { subject: string; html: string } {
  // Validate action_link if present (defense-in-depth)
  if (rawData.action_link && !isValidActionUrl(rawData.action_link)) {
    throw new Error('Invalid action URL');
  }

  // Escape all user-provided data to prevent XSS
  const data: Record<string, string> = {};
  for (const [key, value] of Object.entries(rawData)) {
    // app_url, locale, and action_link are trusted internal values, don't escape them
    // (action_link is validated above)
    if (key === "app_url" || key === "locale" || key === "action_link") {
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

    case "client_invitation":
      return {
        subject: emailT("email_invitation_subject", locale, { courier_name: data.courier_name }),
        html: `
          <!DOCTYPE html>
          <html>
          <head>${baseStyles}</head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${emailT("email_invitation_title", locale)}</h1>
              </div>
              <div class="content">
                <p>${emailT("email_invitation_intro", locale, {
                  client_name: data.client_name,
                  courier_name: data.courier_name
                })}</p>
                <p>${emailT("email_invitation_instructions", locale)}</p>
                <a href="${data.action_link}" class="button">${emailT("email_invitation_button", locale)}</a>
                <p class="small" style="font-size: 12px; color: #6b7280; margin-top: 16px;">${emailT("email_invitation_expiry", locale)}</p>
              </div>
              <div class="footer">
                <p>${emailT("email_invitation_help", locale)}</p>
              </div>
            </div>
          </body>
          </html>
        `,
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
    // Track function start time for timeout guard
    const functionStartTime = Date.now();

    // Get Resend configuration
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const resendFromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "noreply@resend.dev";

    if (!resendApiKey) {
      return createErrorResponse("CONFIG_ERROR", "Email service not configured", 500, corsHeaders, false);
    }

    // Get the authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return createErrorResponse("AUTH_ERROR", "No authorization header", 401, corsHeaders, false);
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
        return createErrorResponse("AUTH_ERROR", "Invalid or expired session", 401, corsHeaders, false);
      }

      userId = data.claims.sub as string;
    }

    // Parse request body
    const { user_id, template, data: templateData } = await req.json() as EmailData & { user_id: string };

    if (!user_id || !template) {
      return createErrorResponse("VALIDATION_ERROR", "user_id and template are required", 400, corsHeaders, false);
    }

    // Validate required template fields
    const requiredFields = TEMPLATE_REQUIRED_FIELDS[template];
    if (requiredFields) {
      const missingFields = requiredFields.filter(f => !templateData?.[f]);
      if (missingFields.length > 0) {
        return createErrorResponse(
          "VALIDATION_ERROR",
          `Missing required fields for ${template}: ${missingFields.join(", ")}`,
          400,
          corsHeaders,
          false
        );
      }
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
        return createErrorResponse("FORBIDDEN", "Cannot send emails to other users", 403, corsHeaders, false);
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
      return createErrorResponse("USER_NOT_FOUND", "User email not found", 404, corsHeaders, false);
    }

    // Determine locale: prefer from templateData (passed by dispatchNotification), fallback to profile
    const locale = getLocale(templateData?.locale || targetProfile?.locale);

    // Generate email content
    const { subject, html } = generateEmailHtml(template, templateData || {}, locale);

    // Send email via Resend (with retry for rate limits and transient errors)
    // Worst-case without guard: 4 attempts x 10s timeout + 3 retries x 10.3s backoff = ~71s
    // Function timeout guard aborts at 55s to stay within Edge Function 60s limit
    const { response: resendResponse, attempts } = await fetchWithRetry(
      "https://api.resend.com/emails",
      {
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
      },
      { maxRetries: 3, timeoutMs: 10000 },  // 10s timeout (Resend typically responds in <2s)
      shouldRetryResend,
      functionStartTime,
      "[send-email]"
    );

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json() as ResendErrorResponse;
      console.error('[send-email] Resend API error:', JSON.stringify(errorData));

      // Determine error code based on response status and error name
      if (resendResponse.status === 429) {
        const errorName = errorData?.name ?? "unknown";
        if (errorName === "rate_limit_exceeded") {
          const retryAfterHeader = resendResponse.headers.get("retry-after");
          const retryAfterMs = retryAfterHeader ? parseInt(retryAfterHeader, 10) * 1000 : 60000;
          return new Response(
            JSON.stringify({
              success: false,
              error: { code: "RATE_LIMIT", message: "Rate limit exceeded", retryable: true, retryAfterMs },
              attempts,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else {
          // daily_quota_exceeded or monthly_quota_exceeded - not retryable
          return new Response(
            JSON.stringify({
              success: false,
              error: { code: "QUOTA_EXCEEDED", message: "Email quota exceeded", retryable: false },
              attempts,
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      // Other API errors (5xx are retryable, 4xx are not)
      const isRetryable = resendResponse.status >= 500;
      return new Response(
        JSON.stringify({
          success: false,
          error: { code: "API_ERROR", message: "Failed to send email", retryable: isRetryable },
          attempts,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendData = await resendResponse.json() as ResendSuccessResponse;

    // Log successful email delivery for observability
    console.log(`[send-email] Email sent successfully to ${targetUser.email}, id: ${resendData.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        email_id: resendData.id,
        attempts,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error('[send-email] Unexpected error:', error);

    // Check if it's a function timeout error (retryable)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Function timeout limit approaching')) {
      return createErrorResponse("TIMEOUT_ERROR", "Request timeout", 504, getCorsHeaders(req), true);
    }

    return createErrorResponse("INTERNAL_ERROR", "Internal server error", 500, getCorsHeaders(req), false);
  }
});
