import { toast } from 'svelte-sonner';
import type { PostgrestSingleResponse } from '@supabase/supabase-js';

type ToastMessages = {
  loading: string;
  success: string;
  error?: string | ((err: Error) => string);
};

/**
 * Wraps a Supabase operation with toast feedback.
 * Shows loading → success or error automatically.
 *
 * @example
 * await withToast(
 *   () => supabase.from('profiles').update({ name }).eq('id', id),
 *   { loading: m.toast_loading(), success: m.toast_settings_saved() }
 * );
 */
export async function withToast<T>(
  operation: () => Promise<PostgrestSingleResponse<T>>,
  messages: ToastMessages
): Promise<PostgrestSingleResponse<T>> {
  const toastId = toast.loading(messages.loading);

  try {
    const response = await operation();

    if (response.error) {
      const errorMessage = messages.error
        ? typeof messages.error === 'function'
          ? messages.error(new Error(response.error.message))
          : messages.error
        : response.error.message;

      toast.error(errorMessage, { id: toastId, duration: Infinity });
    } else {
      toast.success(messages.success, { id: toastId });
    }

    return response;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const errorMessage = messages.error
      ? typeof messages.error === 'function'
        ? messages.error(error)
        : messages.error
      : error.message;

    toast.error(errorMessage, { id: toastId, duration: Infinity });
    throw err;
  }
}

// Re-export toast for direct usage when withToast isn't suitable
export { toast } from 'svelte-sonner';
