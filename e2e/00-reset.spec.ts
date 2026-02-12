/**
 * Database Reset Script
 *
 * This script runs FIRST (00-) to reset the database to a clean state
 * before the workflow tests run. It:
 * - Deletes all services, clients, service types, zones, notifications
 * - Keeps the courier account but resets settings to defaults
 * - Prepares the database for "fresh account" testing
 *
 * IMPORTANT: This requires SUPABASE_SERVICE_ROLE_KEY in environment
 * to bypass RLS and delete data across all users.
 */

import { config } from 'dotenv';
config(); // Load .env file

import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Default settings for courier profile reset
const DEFAULT_TIME_SLOTS = {
	morning: { start: '08:00', end: '12:00' },
	afternoon: { start: '12:00', end: '17:00' },
	evening: { start: '17:00', end: '20:00' }
};

const DEFAULT_WORKING_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

const DEFAULT_PAST_DUE_SETTINGS = {
	gracePeriodStandard: 30,
	gracePeriodSpecific: 15,
	thresholdApproaching: 120,
	thresholdUrgent: 60,
	thresholdCriticalHours: 24,
	allowClientReschedule: true,
	clientMinNoticeHours: 24,
	clientMaxReschedules: 2,
	pastDueReminderInterval: 60,
	dailySummaryEnabled: true,
	dailySummaryTime: '08:00'
};

const DEFAULT_WORKLOAD_SETTINGS = {
	daily_hours: 8,
	default_service_time_minutes: 30,
	auto_lunch_start: '12:00',
	auto_lunch_end: '13:00',
	review_time: '18:00',
	learning_enabled: true,
	learned_service_time_minutes: null,
	learning_sample_count: 0
};

test.describe('Database Reset', () => {
	test('Reset database to clean state', async () => {
		const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
		const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

		if (!supabaseUrl || !serviceRoleKey) {
			console.log('⚠️  Skipping database reset: Missing SUPABASE_SERVICE_ROLE_KEY');
			console.log('   Set this environment variable to enable full reset.');
			console.log('   Without it, tests will run against existing data.');
			test.skip();
			return;
		}

		// Create admin client that bypasses RLS
		const supabase = createClient(supabaseUrl, serviceRoleKey, {
			auth: { persistSession: false }
		});

		console.log('🗑️  Starting database reset...');

		// 1. Delete all services (and related data via CASCADE)
		const { error: servicesError } = await supabase.from('services').delete().neq('id', '00000000-0000-0000-0000-000000000000');
		if (servicesError) console.log('   Services deletion:', servicesError.message);
		else console.log('   ✓ Deleted all services');

		// 2. Delete service reschedule history
		const { error: rescheduleError } = await supabase
			.from('service_reschedule_history')
			.delete()
			.neq('id', '00000000-0000-0000-0000-000000000000');
		if (rescheduleError) console.log('   Reschedule history:', rescheduleError.message);
		else console.log('   ✓ Deleted reschedule history');

		// 3. Delete all notifications
		const { error: notificationsError } = await supabase
			.from('notifications')
			.delete()
			.neq('id', '00000000-0000-0000-0000-000000000000');
		if (notificationsError) console.log('   Notifications deletion:', notificationsError.message);
		else console.log('   ✓ Deleted all notifications');

		// 4. Delete all service types
		const { error: serviceTypesError } = await supabase
			.from('service_types')
			.delete()
			.neq('id', '00000000-0000-0000-0000-000000000000');
		if (serviceTypesError) console.log('   Service types deletion:', serviceTypesError.message);
		else console.log('   ✓ Deleted all service types');

		// 5. Delete all distribution zones
		const { error: zonesError } = await supabase
			.from('distribution_zones')
			.delete()
			.neq('id', '00000000-0000-0000-0000-000000000000');
		if (zonesError) console.log('   Distribution zones deletion:', zonesError.message);
		else console.log('   ✓ Deleted all distribution zones');

		// 6. Delete all client auth users and profiles
		// First get all client user IDs
		const { data: clientProfiles } = await supabase
			.from('profiles')
			.select('id')
			.eq('role', 'client');

		if (clientProfiles && clientProfiles.length > 0) {
			// Delete auth users for each client
			for (const profile of clientProfiles) {
				const { error: authError } = await supabase.auth.admin.deleteUser(profile.id);
				if (authError) console.log(`   Auth user ${profile.id} deletion:`, authError.message);
			}
			console.log(`   ✓ Deleted ${clientProfiles.length} client auth users`);
		}

		// Also clean up any orphaned auth users (test emails without profiles)
		const TEST_EMAILS = ['test@example.com', 'test@example.pt'];
		const { data: authUsers } = await supabase.auth.admin.listUsers();
		if (authUsers?.users) {
			for (const user of authUsers.users) {
				if (user.email && TEST_EMAILS.includes(user.email)) {
					const { error: authError } = await supabase.auth.admin.deleteUser(user.id);
					if (authError) console.log(`   Orphaned auth user ${user.email} deletion:`, authError.message);
					else console.log(`   ✓ Deleted orphaned auth user: ${user.email}`);
				}
			}
		}

		// Then delete profiles (this should cascade but let's be explicit)
		const { error: clientsError } = await supabase.from('profiles').delete().eq('role', 'client');
		if (clientsError) console.log('   Client profiles deletion:', clientsError.message);
		else console.log('   ✓ Deleted all client profiles');

		// 7. Reset courier profile to defaults
		const { error: courierError } = await supabase
			.from('profiles')
			.update({
				// Reset pricing settings
				pricing_model: null,
				vat_enabled: false,
				vat_rate: null,
				prices_include_vat: false,
				show_price_to_courier: true,
				show_price_to_client: true,
				out_of_zone_surcharge: null,
				// Reset scheduling settings
				time_slots: DEFAULT_TIME_SLOTS,
				working_days: DEFAULT_WORKING_DAYS,
				// Reset other settings
				past_due_settings: DEFAULT_PAST_DUE_SETTINGS,
				workload_settings: DEFAULT_WORKLOAD_SETTINGS,
				notification_preferences: null,
				// Keep name and phone as-is (will be set in test 1.1)
				default_pickup_location: null,
				default_pickup_lat: null,
				default_pickup_lng: null
			})
			.eq('role', 'courier');
		if (courierError) console.log('   Courier profile reset:', courierError.message);
		else console.log('   ✓ Reset courier profile to defaults');

		// 8. Delete push subscriptions
		const { error: pushError } = await supabase
			.from('push_subscriptions')
			.delete()
			.neq('id', '00000000-0000-0000-0000-000000000000');
		if (pushError) console.log('   Push subscriptions:', pushError.message);
		else console.log('   ✓ Deleted push subscriptions');

		console.log('✅ Database reset complete!');

		// Verify reset was successful
		const { count: servicesCount } = await supabase
			.from('services')
			.select('*', { count: 'exact', head: true });
		const { count: clientsCount } = await supabase
			.from('profiles')
			.select('*', { count: 'exact', head: true })
			.eq('role', 'client');
		const { count: typesCount } = await supabase
			.from('service_types')
			.select('*', { count: 'exact', head: true });

		expect(servicesCount).toBe(0);
		expect(clientsCount).toBe(0);
		expect(typesCount).toBe(0);

		console.log('✅ Verification passed: Database is clean');
	});
});
