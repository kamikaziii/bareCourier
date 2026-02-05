/**
 * Shared CORS utilities for Supabase Edge Functions
 *
 * Dynamically validates origins to support:
 * - Local development (localhost on any port)
 * - Production (barecourier.vercel.app)
 * - Preview deployments (Vercel git-based and hash-based)
 */

/**
 * Validates if an origin is an allowed Vercel preview deployment.
 *
 * Vercel preview URLs follow these patterns:
 * - Git-based: barecourier-git-{branch}-{team}.vercel.app (always contains '-git-')
 * - Hash-based: barecourier-{hash}.vercel.app (alphanumeric hash, typically 9+ chars)
 *
 * Security: We explicitly check for these patterns to prevent subdomain spoofing
 * like 'barecourier-phishing.vercel.app' from being allowed.
 */
function isAllowedVercelPreview(origin: string): boolean {
  // Must start with https://barecourier- and end with .vercel.app
  if (!origin.startsWith("https://barecourier-") || !origin.endsWith(".vercel.app")) {
    return false;
  }

  // Extract the suffix between "barecourier-" and ".vercel.app"
  const suffix = origin.slice("https://barecourier-".length, -".vercel.app".length);

  // Git-based preview: must start with 'git-' (e.g., git-main-username, git-feature-branch-team)
  if (suffix.startsWith("git-")) {
    // Validate: only lowercase alphanumeric and hyphens allowed
    return /^git-[a-z0-9-]+$/.test(suffix);
  }

  // Hash-based preview: Vercel uses 9+ character alphanumeric hashes
  // Requiring 9+ chars blocks common attack words (phishing=8, malware=7, evil=4)
  if (/^[a-z0-9]{9,}$/.test(suffix)) {
    return true;
  }

  return false;
}

/**
 * Checks if an origin is allowed for CORS.
 *
 * Allowed origins:
 * - Any localhost port (http://localhost:*)
 * - Production domain (https://barecourier.vercel.app)
 * - Vercel preview deployments (secure pattern matching)
 */
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;

  return (
    origin.startsWith("http://localhost:") ||
    origin === "https://barecourier.vercel.app" ||
    isAllowedVercelPreview(origin)
  );
}

/**
 * Returns CORS headers for the given request.
 *
 * Sets Access-Control-Allow-Origin to the request origin if allowed,
 * or empty string if not allowed (browser will block the request).
 */
export function getCorsHeaders(req: Request): {
  "Access-Control-Allow-Origin": string;
  "Access-Control-Allow-Headers": string;
} {
  const origin = req.headers.get("Origin") || "";
  const allowedOrigin = isAllowedOrigin(origin) ? origin : "";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}
