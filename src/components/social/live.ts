import { socialLive, syncSocialFromServer } from '@/backend/social';
import type { Result } from '@/backend/types';
import { toastError } from '@/components/ui/Toast';

/**
 * One social hub change, in the demo or for real. The demo runs the store
 * action (the networks are simulated on the device); Supabase builds call
 * the server instead, show its refusal, and re-read the hub so the device
 * shows what the networks really did. Returns error text or null.
 */
export async function socialAct(ownerId: string, demo: () => string | null | void, server: () => Promise<Result<unknown>>): Promise<string | null> {
  if (!socialLive()) return demo() ?? null;
  const res = await server();
  if (!res.ok) {
    toastError(res.error);
    return res.error;
  }
  await syncSocialFromServer(ownerId);
  return null;
}
