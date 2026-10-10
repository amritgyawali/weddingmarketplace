/**
 * Single source of truth for every brand-specific string. Rename the product
 * here and the whole app follows. A super admin can replace any of them
 * without a release (Content studio → App details); `BRAND` reads the
 * replacement first, so every screen follows.
 */
import { contentRuntime } from '@/services/content';

export const BRAND_DEFAULTS = {
  name: 'Vivah',
  genieService: 'Vivah Planners',
  genieTagline: 'A planner makes the calls for you',
  assistantName: 'Vivah',
  assistantTitle: 'Quick help',
  assistantSubtitle: 'Instant answers · planners reply 9am–7pm',
  supportPhone: '+9779801000000',
  supportWhatsApp: '9779801000000',
  supportEmail: 'support@vivah.app',
  /** The registered business behind the app, as named in the Terms and Privacy policy. Set before launch. */
  legalEntity: 'Vivah',
  registeredAddress: 'Kathmandu, Nepal',
  reviewCount: '200,000',
} as const;

export type BrandField = keyof typeof BRAND_DEFAULTS;

export const BRAND_FIELDS = Object.keys(BRAND_DEFAULTS) as BrandField[];

export const BRAND = Object.defineProperties(
  {},
  Object.fromEntries(BRAND_FIELDS.map((field) => [field, { enumerable: true, get: () => contentRuntime.content.brand[field] || BRAND_DEFAULTS[field] }])),
) as { readonly [K in BrandField]: string };
