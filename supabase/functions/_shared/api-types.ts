/**
 * Shared TypeScript types for Edge Function request/response contracts.
 *
 * These types document the API contracts for edge functions and can be used
 * by both the edge functions themselves and frontend code for type safety.
 */

// =============================================================================
// create-client Edge Function
// =============================================================================

/**
 * Request body for the create-client edge function.
 *
 * Two modes:
 * - Password mode (send_invitation: false): Creates user with password, immediately confirmed
 * - Invitation mode (send_invitation: true): Sends email invitation, user sets password on accept
 */
export interface CreateClientRequest {
  /** Client's email address (required) */
  email: string;
  /** Client's display name (required) */
  name: string;
  /** Password for direct creation (required if send_invitation is false) */
  password?: string;
  /** Send invitation email instead of creating with password (default: false) */
  send_invitation?: boolean;
  /** Client's phone number */
  phone?: string;
  /** Default pickup address text */
  default_pickup_location?: string;
  /** Default pickup latitude coordinate */
  default_pickup_lat?: number;
  /** Default pickup longitude coordinate */
  default_pickup_lng?: number;
  /** Default service type UUID */
  default_service_type_id?: string;
}

/**
 * Success response from create-client (HTTP 200).
 */
export interface CreateClientResponse {
  /** Always true for successful responses */
  success: true;
  /** Created user information */
  user: {
    id: string;
    email: string;
  };
  /** Whether an invitation email was sent */
  invitation_sent: boolean;
  /** True if this was a resend of an existing pending invitation */
  resend?: boolean;
}

/**
 * Partial success response from create-client (HTTP 207).
 * User was created but profile update failed.
 */
export interface CreateClientPartialResponse {
  /** Error message describing what failed */
  error: string;
  /** Created user information (user exists despite error) */
  user: {
    id: string;
    email: string;
  };
  /** Whether an invitation email was sent */
  invitation_sent: boolean;
}

// =============================================================================
// check-client-status Edge Function (planned)
// =============================================================================

/**
 * Request body for the check-client-status edge function.
 */
export interface CheckClientStatusRequest {
  /** UUID of the client to check */
  client_id: string;
}

/**
 * Response from check-client-status.
 */
export interface CheckClientStatusResponse {
  /** UUID of the client */
  client_id: string;
  /** Client's email address */
  email: string;
  /** Timestamp when email was confirmed, null if not yet confirmed */
  email_confirmed_at: string | null;
  /** Convenience boolean for checking confirmation status */
  is_confirmed: boolean;
  /** Timestamp when the user was created */
  created_at: string;
}

// =============================================================================
// Common Types
// =============================================================================

/**
 * Standard error response for all edge functions.
 * Returned for HTTP 400, 401, 403, 500 errors.
 */
export interface ApiErrorResponse {
  /** Human-readable error message */
  error: string;
}

/**
 * Union type for all possible create-client responses.
 * Useful for type narrowing based on response properties.
 */
export type CreateClientResult =
  | CreateClientResponse
  | CreateClientPartialResponse
  | ApiErrorResponse;
