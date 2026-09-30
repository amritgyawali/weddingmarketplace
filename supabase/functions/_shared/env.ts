/** Edge Function configuration from Supabase secrets (`supabase secrets set`). */
import type { Redis } from './ratelimit.ts';

/** Deno's runtime, typed locally so these files also load in Node for the tests. */
export const deno = () => (globalThis as unknown as { Deno: { env: { get(name: string): string | undefined }; serve(handler: (req: Request) => Response | Promise<Response>): void } }).Deno;

export const env = (name: string) => {
  const v = deno().env.get(name);
  return v && v.trim() ? v.trim() : undefined;
};

/** Supabase sets these three itself. */
export const supabaseUrl = () => env('SUPABASE_URL') ?? '';
export const anonKey = () => env('SUPABASE_ANON_KEY') ?? '';
export const serviceKey = () => env('SUPABASE_SERVICE_ROLE_KEY') ?? '';

export const redis = (): Redis | null => {
  const url = env('UPSTASH_REDIS_REST_URL');
  const token = env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url, token } : null;
};

export const appUrl = () => env('APP_URL') ?? 'https://vivah.com.np';
