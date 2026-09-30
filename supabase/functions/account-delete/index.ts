/**
 * account-delete: closes the signed-in user's account (Settings → Delete my
 * account; Google Play requires it in the app).
 *
 *   POST { "confirm": "DELETE" } (Authorization: Bearer <user JWT>)
 *   → { deleted: true, files: <number removed> }
 *
 * 1. rpc_delete_my_account, as the user: refuses while a celebration, booking,
 *    refund or payout is still open; otherwise removes or anonymises their
 *    personal data and keeps the accounting records.
 * 2. Their private files (<user id>/… in the documents bucket, KYC included)
 *    are removed. Project contracts and invoices live under projects/ and stay.
 * 3. The auth user is soft-deleted, so the email can't sign in again.
 *
 * Every step is safe to repeat, so if 2 or 3 fails the app just tries again.
 */
import { deno } from '../_shared/env.ts';
import { fail, json, preflight } from '../_shared/http.ts';
import { callerId, listFiles, removeFiles, softDeleteUser, userRpc } from '../_shared/supabase.ts';

deno().serve(async (req) => {
  const early = preflight(req);
  if (early) return early;
  if (req.method !== 'POST') return fail('Use POST', 405);

  const userId = await callerId(req);
  if (!userId) return fail('Sign in again to continue', 401);

  let confirm: unknown;
  try {
    confirm = ((await req.json()) as { confirm?: unknown }).confirm;
  } catch {
    return fail('Type DELETE to confirm');
  }
  if (typeof confirm !== 'string' || confirm.trim().toUpperCase() !== 'DELETE') return fail('Type DELETE to confirm');

  const closed = await userRpc<{ deleted: boolean }>(req, 'rpc_delete_my_account', { p_confirm: 'DELETE' });
  if (!closed.ok) return fail(closed.message, closed.status);

  try {
    // The caller's own folder only, whatever the RPC answered.
    const files = await listFiles('documents', userId);
    await removeFiles('documents', files);
    await softDeleteUser(userId);
    return json({ deleted: true, files: files.length });
  } catch (e) {
    console.error('account-delete', userId, e);
    return fail('Your account is closed, but removing your files didn’t finish. Try again in a minute.', 502);
  }
});
