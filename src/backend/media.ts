/**
 * Images and short video on Cloudinary (master plan §7.4). Uploads are signed
 * by the media-sign Edge Function, go straight from the phone to Cloudinary,
 * and are recorded with rpc_register_media. Postgres keeps only the public id;
 * the app builds URLs with named transformations so the transformation count
 * (and credit use) stays predictable.
 */
import { ENV, usesSupabase } from '@/constants/env';

import { getAccessToken } from './auth';
import { rpc } from './supabase';
import { failResult, okResult, type Result } from './types';

export type MediaPurpose = 'portfolio' | 'gallery' | 'avatar' | 'idea';

/** Named transformations (created by scripts/cloudinary-setup.mjs). */
export type NamedTransformation = 't_thumb' | 't_card' | 't_hero' | 't_full';

/** True when uploads go to Cloudinary (Supabase and a cloud name configured). */
export const cloudMediaReady = () => usesSupabase() && !!ENV.cloudinaryCloudName;

/** A delivery URL for a public id, at one of the named sizes. */
export function cloudinaryUrl(publicId: string, t: NamedTransformation = 't_card', kind: 'image' | 'video' = 'image') {
  return `https://res.cloudinary.com/${ENV.cloudinaryCloudName}/${kind}/upload/${t}/${publicId.split('/').map(encodeURIComponent).join('/')}`;
}

interface Signature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  uploadPreset: string;
  allowedFormats: string;
  maxBytes: number;
  resource: 'image' | 'auto';
}

export interface UploadInput {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}

export interface Uploaded {
  publicId: string;
  kind: 'image' | 'video';
  width?: number;
  height?: number;
  url: string;
}

async function signFor(purpose: MediaPurpose): Promise<Result<Signature>> {
  const token = await getAccessToken();
  if (!token) return failResult('Sign in again to upload');
  try {
    const res = await fetch(`${ENV.supabaseUrl}/functions/v1/media-sign`, {
      method: 'POST',
      headers: { apikey: ENV.supabasePublishableKey ?? '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ purpose }),
    });
    const body = (await res.json()) as Signature & { message?: string };
    return res.ok ? okResult(body) : failResult(body.message ?? 'Couldn’t start the upload');
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}

/** Uploads one picked file and records it (portfolio items land in the owner's portfolio). */
export async function uploadMedia(file: UploadInput, purpose: MediaPurpose, caption?: string): Promise<Result<Uploaded>> {
  const sig = await signFor(purpose);
  if (!sig.ok) return sig;
  const s = sig.value;
  if (file.fileSize && file.fileSize > s.maxBytes) return failResult(`That file is over ${Math.round(s.maxBytes / 1024 / 1024)} MB`);
  const form = new FormData();
  // React Native's FormData takes { uri, name, type } for files; the web build gets a Blob.
  if (file.uri.startsWith('blob:') || file.uri.startsWith('data:')) form.append('file', await (await fetch(file.uri)).blob(), file.fileName ?? 'upload');
  else form.append('file', { uri: file.uri, name: file.fileName ?? 'upload.jpg', type: file.mimeType ?? 'image/jpeg' } as unknown as Blob);
  form.append('api_key', s.apiKey);
  form.append('timestamp', String(s.timestamp));
  form.append('signature', s.signature);
  form.append('folder', s.folder);
  form.append('upload_preset', s.uploadPreset);
  form.append('allowed_formats', s.allowedFormats);
  try {
    const res = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/${s.resource}/upload`, { method: 'POST', body: form });
    const body = (await res.json()) as { public_id?: string; resource_type?: string; width?: number; height?: number; error?: { message: string } };
    if (!res.ok || !body.public_id) return failResult(body.error?.message ?? 'The upload didn’t finish');
    const kind = body.resource_type === 'video' ? 'video' : 'image';
    const saved = await rpc<string>('rpc_register_media', { p_purpose: purpose, p_public_id: body.public_id, p_kind: kind.toUpperCase(), p_caption: caption ?? null });
    if (!saved.ok) return saved;
    return okResult({ publicId: body.public_id, kind, width: body.width, height: body.height, url: cloudinaryUrl(body.public_id, 't_card', kind) });
  } catch {
    return failResult('The upload was interrupted. Try again on a steadier connection.');
  }
}
