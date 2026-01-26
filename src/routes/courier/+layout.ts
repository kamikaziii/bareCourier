import type { LayoutLoad } from './$types';
import { createProtectedLayoutLoad } from '$lib/utils.js';

export const load: LayoutLoad = createProtectedLayoutLoad();
