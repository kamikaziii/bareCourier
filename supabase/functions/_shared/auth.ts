/**
 * Shared authentication utilities for Supabase Edge Functions
 *
 * Provides secure authentication helpers for edge functions.
 */

import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import { createClient, SupabaseClient, User } from "jsr:@supabase/supabase-js@2";
import { getCorsHeaders } from "./cors.ts";

/**
 * Timing-safe comparison for service role key authentication.
 *
 * Uses constant-time comparison to prevent timing attacks that could
 * leak information about the service key through response time analysis.
 *
 * @param authHeader - The Authorization header value (e.g., "Bearer sk-...")
 * @param serviceKey - The expected service role key from environment
 * @returns true if the bearer token matches the service key
 */
export function isServiceRoleKey(authHeader: string, serviceKey: string): boolean {
  const bearerToken = authHeader.replace("Bearer ", "");

  // Early return if lengths differ (timing-safe comparison requires same length)
  // This is safe because the length comparison itself doesn't reveal key content
  if (bearerToken.length !== serviceKey.length) return false;

  return timingSafeEqual(
    Buffer.from(bearerToken),
    Buffer.from(serviceKey)
  );
}

/**
 * Context returned on successful courier authentication
 */
export interface CourierAuthContext {
  user: User;
  supabaseAdmin: SupabaseClient;
  supabaseUser: SupabaseClient;
}

/**
 * Result type for requireCourier()
 */
export type CourierAuthResult =
  | { success: true; context: CourierAuthContext }
  | { success: false; response: Response };

/**
 * Validates that the request is from an authenticated courier.
 *
 * Performs the following checks:
 * 1. Authorization header is present
 * 2. User is authenticated (valid JWT via getUser)
 * 3. User has courier role in profiles table
 *
 * @param req - The incoming request
 * @returns Either success with auth context, or failure with pre-built Response
 *
 * @example
 * ```typescript
 * const auth = await requireCourier(req);
 * if (!auth.success) {
 *   return auth.response;
 * }
 * const { user, supabaseAdmin } = auth.context;
 * // Function-specific logic...
 * ```
 */
export async function requireCourier(req: Request): Promise<CourierAuthResult> {
  const corsHeaders = getCorsHeaders(req);

  // Check for authorization header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  // Get environment variables
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Create client with user's JWT to check permissions
  const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  // Verify the caller using modern JWT validation (recommended by Supabase)
  const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
  if (userError || !user) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  // Verify caller is a courier
  const { data: profile, error: profileError } = await supabaseUser
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || profile?.role !== "courier") {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: "Only couriers can perform this action" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      ),
    };
  }

  // Create admin client for privileged operations
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    success: true,
    context: {
      user,
      supabaseAdmin,
      supabaseUser,
    },
  };
}
