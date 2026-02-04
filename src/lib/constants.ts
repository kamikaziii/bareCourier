/**
 * Application constants
 *
 * Centralized constants to avoid hardcoding values across the codebase.
 */

import { PUBLIC_APP_URL } from '$env/static/public';

/**
 * The base URL of the application.
 * Uses PUBLIC_APP_URL environment variable with fallback to production URL.
 * Set PUBLIC_APP_URL in your environment to override for different deployments.
 */
export const APP_URL = PUBLIC_APP_URL || 'https://barecourier.vercel.app';
