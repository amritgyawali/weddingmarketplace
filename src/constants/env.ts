/**
 * Public configuration from `EXPO_PUBLIC_*` variables (`.env.local`, EAS and
 * Vercel environment variables; see `.env.example`). Expo inlines these at
 * build time, so each one must be read as `process.env.EXPO_PUBLIC_NAME`
 * literally. Server secrets never appear here.
 */
const read = (value: string | undefined) => (value && value.trim() ? value.trim() : undefined);

export const ENV = {
  /** `mock` (the on-device demo backend, the default) or `supabase`. */
  backend: read(process.env.EXPO_PUBLIC_BACKEND) === 'supabase' ? ('supabase' as const) : ('mock' as const),
  appUrl: read(process.env.EXPO_PUBLIC_APP_URL) ?? 'https://vivah.com.np',
  supabaseUrl: read(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabasePublishableKey: read(process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  cloudinaryCloudName: read(process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME),
  posthogKey: read(process.env.EXPO_PUBLIC_POSTHOG_KEY),
  posthogHost: read(process.env.EXPO_PUBLIC_POSTHOG_HOST) ?? 'https://us.i.posthog.com',
  sentryDsn: read(process.env.EXPO_PUBLIC_SENTRY_DSN),
  googleMapsApiKey: read(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY),
  turnstileSiteKey: read(process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY),
  easProjectId: read(process.env.EXPO_PUBLIC_EAS_PROJECT_ID),
  paymentMode: read(process.env.EXPO_PUBLIC_PAYMENT_MODE) === 'live' ? ('live' as const) : ('sandbox' as const),
  /** `on` shows shake-to-report in an installed test build (development builds always have it). */
  bugReports: read(process.env.EXPO_PUBLIC_BUG_REPORTS) === 'on',
  /** A bug inbox (`npm run bugs:inbox`) for builds without a dev server. Development builds use the dev server's own inbox. */
  bugInboxUrl: read(process.env.EXPO_PUBLIC_BUG_INBOX_URL),
};

/** True when the real backend is switched on and configured. */
export const usesSupabase = () => ENV.backend === 'supabase' && !!ENV.supabaseUrl && !!ENV.supabasePublishableKey;
