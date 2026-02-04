/**
 * Shared authentication utilities for Supabase Edge Functions
 *
 * Provides secure authentication helpers for edge functions.
 */

import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";

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
