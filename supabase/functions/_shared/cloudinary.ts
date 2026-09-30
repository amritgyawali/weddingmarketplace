/**
 * Signed Cloudinary uploads (master plan §7.4). The app never holds the API
 * secret: it asks media-sign for a signature for one purpose, then uploads
 * straight to Cloudinary. The signature pins the folder (one per owner) and
 * the upload preset (size limit, formats, 2,400 px resize), so a client can't
 * upload elsewhere or bigger.
 *
 * Cloudinary's rule: sort the parameters by name, join as `k=v` with `&`,
 * append the API secret, SHA-1, hex.
 */

export type Purpose = 'portfolio' | 'gallery' | 'avatar' | 'idea';

export interface PurposeRule {
  preset: string;
  formats: string[];
  /** Largest file the preset accepts, for the app's own check before uploading. */
  maxBytes: number;
  resource: 'image' | 'auto';
}

export const PURPOSES: Record<Purpose, PurposeRule> = {
  portfolio: { preset: 'vivah_portfolio', formats: ['jpg', 'jpeg', 'png', 'webp', 'heic', 'mp4', 'mov'], maxBytes: 40 * 1024 * 1024, resource: 'auto' },
  gallery: { preset: 'vivah_gallery', formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'], maxBytes: 20 * 1024 * 1024, resource: 'image' },
  avatar: { preset: 'vivah_avatar', formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'], maxBytes: 5 * 1024 * 1024, resource: 'image' },
  idea: { preset: 'vivah_idea', formats: ['jpg', 'jpeg', 'png', 'webp', 'heic'], maxBytes: 10 * 1024 * 1024, resource: 'image' },
};

export const isPurpose = (x: unknown): x is Purpose => typeof x === 'string' && x in PURPOSES;

/** The string Cloudinary signs: sorted `k=v` pairs, empty values left out. */
export const toSign = (params: Record<string, string | number>) =>
  Object.keys(params)
    .filter((k) => params[k] !== '' && params[k] !== undefined && params[k] !== null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-1 signature of the parameters with the API secret (Web Crypto: Deno and Node). */
export async function sign(params: Record<string, string | number>, apiSecret: string): Promise<string> {
  const data = new TextEncoder().encode(toSign(params) + apiSecret);
  return hex(await crypto.subtle.digest('SHA-1', data));
}

/** Parameters for one signed upload by one user. */
export function uploadParams(purpose: Purpose, userId: string, nowSeconds: number) {
  const rule = PURPOSES[purpose];
  return {
    allowed_formats: rule.formats.join(','),
    folder: `vivah/${purpose}/${userId}`,
    timestamp: nowSeconds,
    upload_preset: rule.preset,
  };
}

/** Named transformations the app uses (created by scripts/cloudinary-setup.mjs). */
export const NAMED_TRANSFORMATIONS: Record<string, string> = {
  t_thumb: 'c_fill,g_auto,w_240,h_240,q_auto,f_auto',
  t_card: 'c_fill,g_auto,w_720,h_540,q_auto,f_auto',
  t_hero: 'c_fill,g_auto,w_1600,h_900,q_auto,f_auto',
  t_full: 'c_limit,w_2400,h_2400,q_auto,f_auto',
};
