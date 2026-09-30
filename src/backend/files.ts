/**
 * Private documents in Supabase Storage (master plan §7.4): KYC papers,
 * contracts and invoices never sit on a public CDN. Each user writes under
 * `<their id>/…` (KYC under `<id>/kyc/…`); reading is by a signed URL that
 * lasts five minutes. The bucket's RLS (0012) decides who may read what.
 */
import { ENV, usesSupabase } from '@/constants/env';

import { getAccessToken, loadSession } from './auth';
import { failResult, okResult, type Result } from './types';

const BUCKET = 'documents';

export const privateFilesReady = () => usesSupabase();

const safeName = (name: string) => name.replace(/[^\w.-]+/g, '-').slice(-80) || 'document';

/** Uploads a picked file to the signed-in user's folder; resolves to its storage path. */
export async function uploadDocument(file: { uri: string; name: string; mimeType?: string | null }, folder: 'kyc' | 'contracts' | 'invoices' = 'kyc'): Promise<Result<string>> {
  const token = await getAccessToken();
  const session = await loadSession();
  if (!token || !session) return failResult('Sign in again to upload');
  const path = `${session.userId}/${folder}/${Date.now().toString(36)}-${safeName(file.name)}`;
  try {
    const blob = await (await fetch(file.uri)).blob();
    const res = await fetch(`${ENV.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { apikey: ENV.supabasePublishableKey ?? '', Authorization: `Bearer ${token}`, 'Content-Type': file.mimeType ?? blob.type ?? 'application/octet-stream', 'x-upsert': 'false' },
      body: blob,
    });
    if (!res.ok) return failResult(((await res.json().catch(() => ({}))) as { message?: string }).message ?? 'The upload didn’t finish');
    return okResult(path);
  } catch {
    return failResult('The upload was interrupted. Try again on a steadier connection.');
  }
}

/** A short-lived link to read a private document the caller is allowed to see. */
export async function documentLink(path: string, seconds = 300): Promise<Result<string>> {
  const token = await getAccessToken();
  if (!token) return failResult('Sign in again to open this');
  try {
    const res = await fetch(`${ENV.supabaseUrl}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: 'POST',
      headers: { apikey: ENV.supabasePublishableKey ?? '', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: seconds }),
    });
    const body = (await res.json()) as { signedURL?: string; message?: string };
    return res.ok && body.signedURL ? okResult(`${ENV.supabaseUrl}/storage/v1${body.signedURL}`) : failResult(body.message ?? 'You can’t open this document');
  } catch {
    return failResult('No connection. Check your internet and try again.');
  }
}
