import { toast } from '$lib/utils/toast.js';

export interface FetchWithToastOptions<T> {
	/** Success message to display */
	successMessage: string;
	/** Error message to display - REQUIRED for security (never expose raw server errors) */
	errorMessage: string;
	/** Duration for error toasts in ms (default: 8000ms) */
	errorDuration?: number;
	/** Custom success check function (default: checks result.data?.success || result.success || result.type === 'success') */
	isSuccess?: (result: T) => boolean;
}

interface ActionResult {
	data?: { success?: boolean; error?: string };
	success?: boolean;
	error?: string;
	type?: string;
}

/**
 * Fetch wrapper with toast notifications for SvelteKit form actions.
 * Handles the common pattern of POSTing to a form action and showing toasts.
 *
 * @param url - The URL to fetch (typically "?/actionName")
 * @param options - Request options (method, body, etc.)
 * @param toastOptions - Toast configuration
 * @returns The parsed JSON result, or null if the request failed
 *
 * @example
 * ```ts
 * const result = await fetchWithToast(
 *   "?/batchAccept",
 *   { method: "POST", body: formData },
 *   { successMessage: "Batch accepted successfully" }
 * );
 * if (result) {
 *   batch.reset();
 *   await invalidateAll();
 * }
 * ```
 */
export async function fetchWithToast<T extends ActionResult = ActionResult>(
	url: string,
	options: RequestInit,
	toastOptions: FetchWithToastOptions<T>
): Promise<T | null> {
	const {
		successMessage,
		errorMessage,
		errorDuration = 8000,
		isSuccess = (result: T) =>
			result.data?.success || result.success || result.type === 'success'
	} = toastOptions;

	try {
		const response = await fetch(url, options);
		const result = (await response.json()) as T;

		if (isSuccess(result)) {
			toast.success(successMessage);
			return result;
		} else {
			// Always use the provided localized error message - never expose raw server errors
			toast.error(errorMessage, { duration: errorDuration });
			return null;
		}
	} catch {
		// Always use the provided localized error message - never expose raw server errors
		toast.error(errorMessage, { duration: errorDuration });
		return null;
	}
}
