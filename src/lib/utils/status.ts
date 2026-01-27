import * as m from '$lib/paraglide/messages.js';

/**
 * Get the display label for a service delivery status.
 */
export function getStatusLabel(status: string): string {
	return status === 'pending' ? m.status_pending() : m.status_delivered();
}

/**
 * Get the display label for a service request status.
 */
export function getRequestStatusLabel(requestStatus: string): string {
	switch (requestStatus) {
		case 'pending':
			return m.request_status_pending();
		case 'accepted':
			return m.request_status_accepted();
		case 'rejected':
			return m.request_status_rejected();
		case 'suggested':
			return m.request_status_suggested();
		default:
			return requestStatus;
	}
}

/**
 * Get Tailwind border/text color classes for a request status badge.
 */
export function getRequestStatusColor(requestStatus: string): string {
	switch (requestStatus) {
		case 'pending':
			return 'border-yellow-500 text-yellow-500';
		case 'accepted':
			return 'border-green-500 text-green-500';
		case 'rejected':
			return 'border-red-500 text-red-500';
		case 'suggested':
			return 'border-orange-500 text-orange-500';
		default:
			return '';
	}
}
