/**
 * media-sign: a Cloudinary upload signature for one signed-in user and one
 * purpose (portfolio, gallery, avatar, idea). The signature pins the folder
 * vivah/<purpose>/<user id> and the preset, so the upload can only land in the
 * caller's own folder with the preset's limits. After uploading, the app
 * records the result with rpc_register_media, which checks the same folder.
 *
 *   POST { "purpose": "portfolio" } (Authorization: Bearer <user JWT)
 *   → { cloudName, apiKey, timestamp, signature, folder, uploadPreset, allowedFormats, maxBytes, resource }
 */
import { isPurpose, PURPOSES, sign, uploadParams } from '../_shared/cloudinary.ts';
import { deno, env, redis } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { LIMITS, rateLimit } from '../_shared/ratelimit.ts';
import { callerId } from '../_shared/supabase.ts';

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail('Use POST', 405);

  const cloudName = env('CLOUDINARY_CLOUD_NAME');
  const apiKey = env('CLOUDINARY_API_KEY');
  const apiSecret = env('CLOUDINARY_API_SECRET');
  if (!cloudName || !apiKey || !apiSecret) return fail('Uploads aren’t set up yet', 503);

  const userId = await callerId(req);
  if (!userId) return fail('Sign in again to upload', 401);

  let purpose: unknown;
  try {
    purpose = ((await req.json()) as { purpose?: unknown }).purpose;
  } catch {
    return fail('Send JSON with a purpose');
  }
  if (!isPurpose(purpose)) return fail(`Purpose must be one of ${Object.keys(PURPOSES).join(', ')}`);

  const verdict = await rateLimit(redis(), `upload:${userId}`, LIMITS.uploadsPerUser);
  if (!verdict.allowed) return json({ message: 'Upload limit reached for this hour. Try again later.' }, 429, { 'Retry-After': String(verdict.retryAfter) });

  const params = uploadParams(purpose, userId, Math.floor(Date.now() / 1000));
  const signature = await sign(params, apiSecret);
  const rule = PURPOSES[purpose];
  return json({
    cloudName,
    apiKey,
    timestamp: params.timestamp,
    signature,
    folder: params.folder,
    uploadPreset: params.upload_preset,
    allowedFormats: params.allowed_formats,
    maxBytes: rule.maxBytes,
    resource: rule.resource,
  });
});
