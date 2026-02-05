import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import type { Service, Profile } from '$lib/database.types';
import { localizeHref } from '$lib/paraglide/runtime.js';
import * as m from '$lib/paraglide/messages.js';
import { calculateDayWorkload, getWorkloadSettings, type WorkloadEstimate } from '$lib/services/workload.js';
import { notifyClient, getUserLocale } from '$lib/services/notifications';
import { APP_URL } from '$lib/constants.js';

// Number of days to scan ahead when finding the next compatible day
const LOOKAHEAD_DAYS = 14;

// Process notifications in chunks to avoid overwhelming the system
const NOTIFICATION_CHUNK_SIZE = 5;

export const load: PageServerLoad = async ({ locals: { supabase, safeGetSession } }) => {
	const { session, user } = await safeGetSession();
	if (!session || !user) {
		redirect(303, localizeHref('/login'));
	}

	// Load pending service requests (services with request_status = 'pending')
	const { data: pendingRequests } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone)')
		.eq('request_status', 'pending')
		.is('deleted_at', null)
		.order('created_at', { ascending: false });

	// Load services with pending reschedule requests (only client-initiated, not courier's own)
	const { data: pendingReschedules } = await supabase
		.from('services')
		.select('*, profiles!client_id(id, name, phone)')
		.not('pending_reschedule_date', 'is', null)
		.neq('pending_reschedule_requested_by', user.id)
		.is('deleted_at', null)
		.order('pending_reschedule_requested_at', { ascending: true });

	// Get courier profile for workload settings and timezone
	const { data: courierProfile } = await supabase
		.from('profiles')
		.select('workload_settings, timezone')
		.eq('id', user.id)
		.single();

	const settings = getWorkloadSettings(courierProfile?.workload_settings);

	// Use courier's timezone for date calculations (default to Europe/Lisbon)
	const tz = (courierProfile as { timezone?: string } | null)?.timezone || 'Europe/Lisbon';
	const dateFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz });

	// Collect unique dates from requests
	const uniqueDates = new Set<string>();
	const requests = (pendingRequests || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[];
	for (const req of requests) {
		if (req.requested_date) {
			uniqueDates.add(req.requested_date);
		}
	}

	// Always include today and tomorrow (using courier's timezone)
	const now = new Date();
	const todayStr = dateFormatter.format(now);

	const tomorrow = new Date(now);
	tomorrow.setDate(tomorrow.getDate() + 1);
	const tomorrowStr = dateFormatter.format(tomorrow);

	uniqueDates.add(todayStr);
	uniqueDates.add(tomorrowStr);

	// Calculate workload for each unique date (parallelized)
	const workloadEntries = await Promise.all(
		Array.from(uniqueDates).map(async (dateStr) => [
			dateStr,
			await calculateDayWorkload(supabase, user.id, new Date(dateStr + 'T12:00:00'), settings)
		] as const)
	);
	const workloadByDate: Record<string, WorkloadEstimate> = Object.fromEntries(workloadEntries);

	// Find next compatible day (scan up to LOOKAHEAD_DAYS days ahead)
	let nextCompatibleDay: { date: string; workload: WorkloadEstimate } | null = null;
	for (let i = 0; i < LOOKAHEAD_DAYS; i++) {
		const checkDate = new Date(now);
		checkDate.setDate(checkDate.getDate() + i);
		const checkDateStr = dateFormatter.format(checkDate);

		// Use cached workload if available, otherwise calculate
		let workload = workloadByDate[checkDateStr];
		if (!workload) {
			const date = new Date(checkDateStr + 'T12:00:00');
			workload = await calculateDayWorkload(supabase, user.id, date, settings);
			workloadByDate[checkDateStr] = workload;
		}

		if (workload.status === 'comfortable') {
			nextCompatibleDay = { date: checkDateStr, workload };
			break;
		}
	}

	return {
		pendingRequests: requests,
		pendingReschedules: (pendingReschedules || []) as (Service & { profiles: Pick<Profile, 'id' | 'name' | 'phone'> })[],
		workloadByDate,
		todayStr,
		tomorrowStr,
		nextCompatibleDay
	};
};

export const actions: Actions = {
	accept: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get the service to copy requested schedule to scheduled and fetch data for email
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, pickup_location, delivery_location, requested_date, requested_time_slot, requested_time')
			.eq('id', serviceId)
			.single();

		if (!serviceData) {
			return { success: false, error: 'Service not found' };
		}

		const service = serviceData as {
			client_id: string;
			pickup_location: string;
			delivery_location: string;
			requested_date: string | null;
			requested_time_slot: string | null;
			requested_time: string | null;
		};

		// NOTE: Direct update (not RPC) because this sets the FIRST scheduled date.
		// No history tracking needed - reschedule operations use RPC functions.
		const { error: updateError } = await supabase
			.from('services')
			.update({
				request_status: 'accepted',
				scheduled_date: service.requested_date,
				scheduled_time_slot: service.requested_time_slot,
				scheduled_time: service.requested_time
			})
			.eq('id', serviceId);

		if (updateError) {
			console.error('Failed to update request:', updateError);
			return { success: false, error: 'Failed to update request' };
		}

		// Notify client with email
		const locale = await getUserLocale(supabase, service.client_id);
		try {
			await notifyClient({
				session,
				clientId: service.client_id,
				serviceId,
				category: 'schedule_change',
				title: m.notification_request_accepted({}, { locale }),
				message: m.notification_request_accepted_message({}, { locale }),
				emailTemplate: 'request_accepted',
				emailData: {
					pickup_location: service.pickup_location,
					delivery_location: service.delivery_location,
					scheduled_date: service.requested_date || '',
					app_url: APP_URL
				}
			});
		} catch (error) {
			console.error('Notification failed for service', serviceId, error);
		}

		return { success: true };
	},

	reject: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;
		const rejectionReason = formData.get('rejection_reason') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Get service data for email
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, pickup_location, delivery_location')
			.eq('id', serviceId)
			.single();

		const service = serviceData as { client_id: string; pickup_location: string; delivery_location: string } | null;

		const { error: updateError } = await supabase
			.from('services')
			.update({
				request_status: 'rejected',
				rejection_reason: rejectionReason || null
			})
			.eq('id', serviceId);

		if (updateError) {
			console.error('Failed to update request:', updateError);
			return { success: false, error: 'Failed to update request' };
		}

		// Notify client with email
		if (service?.client_id) {
			const locale = await getUserLocale(supabase, service.client_id);
			const reasonText = rejectionReason ? m.notification_reason_prefix({ reason: rejectionReason }, { locale }) : '';
			try {
				await notifyClient({
					session,
					clientId: service.client_id,
					serviceId,
					category: 'schedule_change',
					title: m.notification_request_rejected({}, { locale }),
					message: m.notification_request_rejected_message({ reason: reasonText }, { locale }),
					emailTemplate: 'request_rejected',
					emailData: {
						pickup_location: service.pickup_location,
						delivery_location: service.delivery_location,
						reason: rejectionReason || '',
						app_url: APP_URL
					}
				});
			} catch (error) {
				console.error('Notification failed for service', serviceId, error);
			}
		}

		return { success: true };
	},

	suggest: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;
		const suggestedDate = formData.get('suggested_date') as string;
		const suggestedTimeSlot = formData.get('suggested_time_slot') as string;
		const suggestedTime = (formData.get('suggested_time') as string) || null;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		if (!suggestedDate || !suggestedTimeSlot) {
			return { success: false, error: 'Suggested date and time slot required' };
		}

		if (suggestedTimeSlot === 'specific' && !suggestedTime) {
			return { success: false, error: 'Specific time is required when "specific" time slot is selected' };
		}

		// Get service data for email
		const { data: serviceData } = await supabase
			.from('services')
			.select('client_id, pickup_location, delivery_location, requested_date')
			.eq('id', serviceId)
			.single();

		const service = serviceData as {
			client_id: string;
			pickup_location: string;
			delivery_location: string;
			requested_date: string | null;
		} | null;

		const { error: updateError } = await supabase
			.from('services')
			.update({
				request_status: 'suggested',
				suggested_date: suggestedDate,
				suggested_time_slot: suggestedTimeSlot,
				suggested_time: suggestedTime
			})
			.eq('id', serviceId);

		if (updateError) {
			console.error('Failed to update request:', updateError);
			return { success: false, error: 'Failed to update request' };
		}

		// Notify client with email
		if (service?.client_id) {
			const locale = await getUserLocale(supabase, service.client_id);
			const dateFormatted = new Date(suggestedDate).toLocaleDateString(locale);
			const slotLabels: Record<string, Record<string, string>> = {
				'pt-PT': {
					morning: 'Manhã',
					afternoon: 'Tarde',
					evening: 'Noite',
					specific: 'Hora específica'
				},
				en: {
					morning: 'Morning',
					afternoon: 'Afternoon',
					evening: 'Evening',
					specific: 'Specific time'
				}
			};
			const labels = slotLabels[locale] || slotLabels['pt-PT'];
			const slotText = suggestedTimeSlot === 'specific' && suggestedTime
				? suggestedTime
				: (labels[suggestedTimeSlot] || suggestedTimeSlot);

			try {
				await notifyClient({
					session,
					clientId: service.client_id,
					serviceId,
					category: 'schedule_change',
					title: m.notification_reschedule_proposal({}, { locale }),
					message: m.notification_reschedule_proposal_message({ date: dateFormatted, slot: slotText }, { locale }),
					emailTemplate: 'request_suggested',
					emailData: {
						pickup_location: service.pickup_location,
						delivery_location: service.delivery_location,
						requested_date: service.requested_date || '',
						suggested_date: suggestedDate,
						app_url: APP_URL
					}
				});
			} catch (error) {
				console.error('Notification failed for service', serviceId, error);
			}
		}

		return { success: true };
	},

	approveReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Use RPC function to atomically approve reschedule
		// This updates both services and service_reschedule_history in a single transaction
		const { data: rpcResult, error: rpcError } = await supabase.rpc('approve_reschedule', {
			p_service_id: serviceId,
			p_approved_by: user.id
		});

		if (rpcError) {
			console.error('Failed RPC call:', rpcError);
			return { success: false, error: 'An unexpected error occurred' };
		}

		const result = rpcResult as { success: boolean; error?: string; client_id?: string };

		if (!result.success) {
			return { success: false, error: result.error || 'Failed to approve reschedule' };
		}

		// Notify client
		if (result.client_id) {
			// Fetch service data for email
			const { data: serviceData } = await supabase
				.from('services')
				.select('pickup_location, delivery_location, scheduled_date')
				.eq('id', serviceId)
				.single();

			const svcData = serviceData as { pickup_location: string; delivery_location: string; scheduled_date: string | null } | null;
			const locale = await getUserLocale(supabase, result.client_id);

			try {
				await notifyClient({
					session,
					clientId: result.client_id,
					serviceId,
					category: 'schedule_change',
					title: m.notification_reschedule_approved({}, { locale }),
					message: m.notification_reschedule_approved_message({}, { locale }),
					emailTemplate: 'request_accepted',
					emailData: {
						pickup_location: svcData?.pickup_location || '',
						delivery_location: svcData?.delivery_location || '',
						scheduled_date: svcData?.scheduled_date || '',
						app_url: APP_URL
					}
				});
			} catch (error) {
				console.error('Notification failed for service', serviceId, error);
			}
		}

		return { success: true };
	},

	batchAccept: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if ((profile as { role: string } | null)?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		let serviceIds: string[];
		try {
			serviceIds = JSON.parse(formData.get('service_ids') as string);
		} catch {
			return { success: false, error: 'Invalid service selection' };
		}

		if (!serviceIds?.length) {
			return { success: false, error: 'No services selected' };
		}

		const MAX_BATCH_SIZE = 50;

		if (serviceIds.length > MAX_BATCH_SIZE) {
			return {
				success: false,
				error: `Maximum ${MAX_BATCH_SIZE} services per batch. Please select fewer services.`
			};
		}

		// Get all services to copy requested schedule to scheduled
		const { data: servicesData } = await supabase
			.from('services')
			.select('id, client_id, pickup_location, delivery_location, requested_date, requested_time_slot, requested_time')
			.in('id', serviceIds);

		if (!servicesData?.length) {
			return { success: false, error: 'Services not found' };
		}

		// NOTE: This uses direct updates (not RPC) because accepting a request sets the
		// FIRST scheduled date - there's no schedule change to track in history.
		// Reschedule operations (changing an existing schedule) use RPC functions like
		// client_approve_reschedule, client_deny_reschedule, or reschedule_service.
		// See: supabase/migrations/20260204000001_create_missing_reschedule_rpcs.sql
		const updatePromises = (servicesData as Array<{
			id: string;
			client_id: string;
			pickup_location: string;
			delivery_location: string;
			requested_date: string | null;
			requested_time_slot: string | null;
			requested_time: string | null;
		}>).map(async (svc) => {
			const { error: updateError } = await supabase
				.from('services')
				.update({
					request_status: 'accepted',
					scheduled_date: svc.requested_date,
					scheduled_time_slot: svc.requested_time_slot,
					scheduled_time: svc.requested_time
				})
				.eq('id', svc.id);

			if (!updateError) {
				return {
					id: svc.id,
					success: true,
					clientId: svc.client_id,
					pickup_location: svc.pickup_location,
					delivery_location: svc.delivery_location,
					scheduled_date: svc.requested_date
				};
			}
			return { id: svc.id, success: false, error: updateError };
		});

		const results = await Promise.all(updatePromises);
		const successful = results.filter((r): r is Extract<typeof r, { success: true }> => r.success);
		const failed = results.filter((r) => !r.success);

		// Send notifications in chunks to avoid overwhelming the system
		if (successful.length > 0) {
			for (let i = 0; i < successful.length; i += NOTIFICATION_CHUNK_SIZE) {
				const chunk = successful.slice(i, i + NOTIFICATION_CHUNK_SIZE);
				try {
					await Promise.all(
						chunk.map(async ({ id, clientId, pickup_location, delivery_location, scheduled_date }) => {
							const locale = await getUserLocale(supabase, clientId);
							return notifyClient({
								session,
								clientId,
								serviceId: id,
								category: 'schedule_change',
								title: m.notification_request_accepted({}, { locale }),
								message: m.notification_request_accepted_message({}, { locale }),
								emailTemplate: 'request_accepted',
								emailData: {
									pickup_location,
									delivery_location,
									scheduled_date: scheduled_date || '',
									app_url: APP_URL
								}
							});
						})
					);
				} catch (error) {
					console.error('Batch notification failed for chunk', i, error);
				}
			}
		}

		// Return honest response for partial failures
		if (failed.length > 0) {
			return {
				success: false,
				partial: successful.length > 0,
				accepted: successful.length,
				failed: failed.length,
				failedIds: failed.map((r) => r.id),
				error: `${failed.length} of ${serviceIds.length} operations failed`
			};
		}

		return {
			success: true,
			accepted: successful.length
		};
	},

	denyReschedule: async ({ request, locals: { supabase, safeGetSession } }) => {
		const { session, user } = await safeGetSession();
		if (!session || !user) {
			return { success: false, error: 'Not authenticated' };
		}

		// Verify user is courier
		const { data: profile } = await supabase
			.from('profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const userProfile = profile as { role: string } | null;
		if (userProfile?.role !== 'courier') {
			return { success: false, error: 'Unauthorized' };
		}

		const formData = await request.formData();
		const serviceId = formData.get('service_id') as string;
		const denialReason = formData.get('denial_reason') as string;

		if (!serviceId) {
			return { success: false, error: 'Service ID required' };
		}

		// Use RPC function to atomically deny reschedule
		// This updates both services and service_reschedule_history in a single transaction
		const { data: rpcResult, error: rpcError } = await supabase.rpc('deny_reschedule', {
			p_service_id: serviceId,
			p_denied_by: user.id,
			p_denial_reason: denialReason || undefined
		});

		if (rpcError) {
			console.error('Failed RPC call:', rpcError);
			return { success: false, error: 'An unexpected error occurred' };
		}

		const result = rpcResult as { success: boolean; error?: string; client_id?: string };

		if (!result.success) {
			return { success: false, error: result.error || 'Failed to deny reschedule' };
		}

		// Notify client
		if (result.client_id) {
			// Fetch service data for email
			const { data: serviceData } = await supabase
				.from('services')
				.select('pickup_location, delivery_location')
				.eq('id', serviceId)
				.single();

			const svcData = serviceData as { pickup_location: string; delivery_location: string } | null;
			const locale = await getUserLocale(supabase, result.client_id);
			const reasonText = denialReason ? m.notification_reason_prefix({ reason: denialReason }, { locale }) : '';

			try {
				await notifyClient({
					session,
					clientId: result.client_id,
					serviceId,
					category: 'schedule_change',
					title: m.notification_reschedule_denied({}, { locale }),
					message: m.notification_reschedule_denied_message({ reason: reasonText }, { locale }),
					emailTemplate: 'request_rejected',
					emailData: {
						pickup_location: svcData?.pickup_location || '',
						delivery_location: svcData?.delivery_location || '',
						reason: denialReason || '',
						app_url: APP_URL
					}
				});
			} catch (error) {
				console.error('Notification failed for service', serviceId, error);
			}
		}

		return { success: true };
	}
};
