/**
 * Picks the backend from EXPO_PUBLIC_BACKEND: `mock` (the default: the demo
 * and Expo Go) or `supabase` (staging and production, once configured).
 */
import { ENV, usesSupabase } from '@/constants/env';

import { mockBackend } from './mock';
import { supabaseBackend } from './supabase';
import type { Backend } from './types';

export type { Backend, BackendKind, Result } from './types';
export { setAccessToken } from './supabase';

/** The backend this build talks to. Falls back to the demo when Supabase isn't configured. */
export const backend = (): Backend => (ENV.backend === 'supabase' && usesSupabase() ? supabaseBackend : mockBackend);
