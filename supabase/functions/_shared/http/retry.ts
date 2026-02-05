/**
 * Generic HTTP fetch with retry support for transient errors.
 *
 * Features:
 * - Exponential backoff with jitter
 * - Configurable retry count and timeout
 * - Respects retry-after headers
 * - Function-level timeout guard for serverless environments
 * - Customizable retry decision logic via callback
 */

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Maximum number of retry attempts (0 = one attempt, no retries) */
  maxRetries: number;
  /** Request timeout in milliseconds */
  timeoutMs: number;
  /** Base delay for exponential backoff in milliseconds */
  baseDelayMs: number;
  /** Maximum jitter to add to delays in milliseconds */
  maxJitterMs: number;
  /** Maximum retry delay (caps retry-after header values) in milliseconds */
  maxRetryDelayMs: number;
  /** Function-level timeout to abort retries (for serverless environments) in milliseconds */
  functionTimeoutMs?: number;
}

/**
 * Default retry configuration.
 * Uses environment variables with sensible defaults.
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: parseInt(Deno.env.get("HTTP_MAX_RETRIES") || "3"),
  timeoutMs: parseInt(Deno.env.get("HTTP_TIMEOUT_MS") || "30000"),
  baseDelayMs: parseInt(Deno.env.get("HTTP_BASE_DELAY_MS") || "500"),
  maxJitterMs: parseInt(Deno.env.get("HTTP_MAX_JITTER_MS") || "300"),
  maxRetryDelayMs: parseInt(Deno.env.get("HTTP_MAX_RETRY_DELAY_MS") || "10000"),
  functionTimeoutMs: parseInt(Deno.env.get("HTTP_FUNCTION_TIMEOUT_MS") || "55000"),
};

/**
 * Result from fetchWithRetry including attempt count for observability.
 */
export interface FetchWithRetryResult {
  response: Response;
  attempts: number;
}

/**
 * Callback to determine if a response should trigger a retry.
 * Called for responses that aren't automatically retried (i.e., not 5xx).
 *
 * @param response - The HTTP response to evaluate
 * @returns Promise resolving to true if retry should be attempted
 */
export type ShouldRetryCallback = (response: Response) => Promise<boolean>;

/**
 * Default retry decision: retry on 429 (rate limit) responses.
 */
export const defaultShouldRetry: ShouldRetryCallback = async (response: Response): Promise<boolean> => {
  return response.status === 429;
};

/**
 * Calculates backoff delay with exponential increase and jitter.
 *
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelayMs - Base delay in milliseconds
 * @param maxJitterMs - Maximum jitter to add
 * @param retryAfterHeader - Optional retry-after header value (seconds)
 * @param maxRetryDelayMs - Maximum delay cap
 * @returns Delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number,
  maxJitterMs: number,
  retryAfterHeader?: string | null,
  maxRetryDelayMs?: number
): number {
  let baseDelay: number;

  if (retryAfterHeader) {
    const parsedRetryAfter = parseInt(retryAfterHeader, 10);
    if (!isNaN(parsedRetryAfter)) {
      // Convert seconds to milliseconds, cap to max delay
      baseDelay = maxRetryDelayMs
        ? Math.min(parsedRetryAfter * 1000, maxRetryDelayMs)
        : parsedRetryAfter * 1000;
    } else {
      // Invalid header, use exponential backoff
      baseDelay = Math.pow(2, attempt) * baseDelayMs;
    }
  } else {
    // No header, use exponential backoff
    baseDelay = Math.pow(2, attempt) * baseDelayMs;
  }

  // Add jitter to prevent thundering herd
  const jitter = Math.random() * maxJitterMs;
  return baseDelay + jitter;
}

/**
 * Fetches with automatic retry for transient errors.
 *
 * Retry behavior:
 * - 5xx errors: Always retry
 * - 429 errors: Retry by default, customizable via shouldRetry callback
 * - 4xx errors (except 429): Never retry (permanent errors)
 * - Network/timeout errors: Always retry
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch RequestInit options
 * @param config - Retry configuration (uses DEFAULT_RETRY_CONFIG if not provided)
 * @param shouldRetry - Custom callback to determine if a 429 should be retried
 * @param functionStartTime - Start time of the function (for serverless timeout guard)
 * @param logPrefix - Prefix for log messages (default: "[http]")
 * @returns The Response object and attempt count
 * @throws Error if all retries fail due to network/timeout errors or function timeout approaching
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit,
  config: Partial<RetryConfig> = {},
  shouldRetry: ShouldRetryCallback = defaultShouldRetry,
  functionStartTime?: number,
  logPrefix: string = "[http]"
): Promise<FetchWithRetryResult> {
  const fullConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const { maxRetries, timeoutMs, baseDelayMs, maxJitterMs, maxRetryDelayMs, functionTimeoutMs } = fullConfig;

  if (maxRetries < 0) {
    throw new Error("fetchWithRetry: maxRetries must be >= 0");
  }
  if (timeoutMs <= 0) {
    throw new Error("fetchWithRetry: timeoutMs must be > 0");
  }

  const totalAttempts = maxRetries + 1;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check function timeout before attempting (if functionStartTime provided)
    if (functionStartTime && functionTimeoutMs && Date.now() - functionStartTime > functionTimeoutMs) {
      console.log(`${logPrefix} Function timeout approaching, aborting retries`);
      throw new Error("Function timeout limit approaching");
    }

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
        return { response, attempts: attempt + 1 };
      }

      // Permanent 4xx errors (except 429) - fail immediately
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        return { response, attempts: attempt + 1 };
      }

      // For 429, check if caller wants to retry
      if (response.status === 429) {
        const shouldRetryResponse = await shouldRetry(response);
        if (!shouldRetryResponse) {
          return { response, attempts: attempt + 1 };
        }
        // Fall through to retry logic
      }

      // Retry on 429 (if shouldRetry returned true) or 5xx
      if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get("retry-after");
        const delay = calculateBackoff(attempt, baseDelayMs, maxJitterMs, retryAfterHeader, maxRetryDelayMs);

        console.log(
          `${logPrefix} Retry after ${response.status} (attempt ${attempt + 1}/${totalAttempts}), waiting ${Math.round(delay)}ms`
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      // Last attempt or non-retryable - return as-is
      return { response, attempts: attempt + 1 };
    } catch (error) {
      clearTimeout(timeoutId);

      const errorType = error instanceof Error ? error.name : String(error);
      if (errorType === "AbortError") {
        console.log(`${logPrefix} Request timeout (attempt ${attempt + 1}/${totalAttempts})`);
      }

      if (attempt < maxRetries) {
        const delay = calculateBackoff(attempt, baseDelayMs, maxJitterMs);
        console.log(`${logPrefix} Retry after ${errorType} (attempt ${attempt + 1}/${totalAttempts}), waiting ${Math.round(delay)}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw error;
    }
  }

  // This should be unreachable, but TypeScript needs it
  throw new Error(`${logPrefix} fetchWithRetry: unexpected code path`);
}
