/**
 * Shared CORS utilities for Supabase Edge Functions
 *
 * Provides consistent CORS handling across all edge functions.
 * Supports localhost development and Vercel deployments.
 */

/**
 * Checks if an origin is allowed for CORS.
 *
 * Allowed origins:
 * - Any localhost port (http://localhost:*)
 * - Production domain (https://barecourier.vercel.app)
 * - Vercel preview deployments (*barecourier*.vercel.app)
 */
function isAllowedOrigin(origin: string): boolean {
  if (!origin) return false;

  return (
    origin.startsWith("http://localhost:") ||
    origin === "https://barecourier.vercel.app" ||
    (origin.endsWith(".vercel.app") && origin.includes("barecourier"))
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

/**
 * Creates a CORS preflight response for OPTIONS requests.
 */
export function handleCorsPreflightRequest(req: Request): Response {
  return new Response("ok", { headers: getCorsHeaders(req) });
}
