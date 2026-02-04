/**
 * Error mapping utilities for Edge Functions.
 * Maps internal database/service errors to user-friendly messages.
 * Never expose raw database errors to clients.
 */

interface ErrorLike {
  code?: string;
  message?: string;
  status?: number;
}

/**
 * Maps database/service errors to user-friendly messages.
 * Logs original error server-side for debugging.
 *
 * @param error - The error object from Supabase/Postgres
 * @param context - Optional context for logging (e.g., "create-client", "profile update")
 * @returns User-friendly error message
 */
export function mapErrorToUserMessage(error: ErrorLike, context?: string): string {
  // Log original error server-side for debugging
  if (context) {
    console.error(`[${context}] Database error:`, {
      code: error.code,
      message: error.message,
      status: error.status
    });
  } else {
    console.error('Database error:', {
      code: error.code,
      message: error.message,
      status: error.status
    });
  }

  // Handle specific Postgres error codes
  // See: https://www.postgresql.org/docs/current/errcodes-appendix.html

  // Class 23 - Integrity Constraint Violation
  if (error.code === '23505') {
    // unique_violation
    return 'A record with this information already exists.';
  }
  if (error.code === '23503') {
    // foreign_key_violation
    return 'Invalid reference data provided.';
  }
  if (error.code === '23502') {
    // not_null_violation
    return 'Required information is missing.';
  }
  if (error.code === '23514') {
    // check_violation
    return 'The provided data does not meet requirements.';
  }

  // Class 42 - Syntax Error or Access Rule Violation
  if (error.code === '42501') {
    // insufficient_privilege
    return 'You do not have permission to perform this action.';
  }
  if (error.code === '42P01') {
    // undefined_table
    return 'An internal configuration error occurred.';
  }

  // Class 28 - Invalid Authorization
  if (error.code === '28000' || error.code === '28P01') {
    return 'Authentication failed. Please log in again.';
  }

  // Class 08 - Connection Exception
  if (error.code?.startsWith('08')) {
    return 'Unable to connect to the service. Please try again later.';
  }

  // Class 53 - Insufficient Resources
  if (error.code?.startsWith('53')) {
    return 'The service is temporarily unavailable. Please try again later.';
  }

  // Supabase Auth specific errors (check message patterns)
  if (error.message?.includes('User already registered')) {
    return 'A user with this email already exists.';
  }
  if (error.message?.includes('Invalid login credentials')) {
    return 'Invalid login credentials.';
  }
  if (error.message?.includes('Email not confirmed')) {
    return 'Please confirm your email address before signing in.';
  }
  if (error.message?.includes('Token expired')) {
    return 'Your session has expired. Please log in again.';
  }

  // Generic fallback - never expose raw error
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Maps email-specific errors to user-friendly messages.
 *
 * @param error - The error from email sending
 * @returns User-friendly error message
 */
export function mapEmailErrorToUserMessage(error: ErrorLike): string {
  console.error('Email error:', {
    code: error.code,
    message: error.message
  });

  if (error.message?.includes('rate limit')) {
    return 'Too many emails sent. Please wait before trying again.';
  }
  if (error.message?.includes('invalid email')) {
    return 'The email address appears to be invalid.';
  }

  return 'Failed to send email. Please try again later.';
}
