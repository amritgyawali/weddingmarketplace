import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { experienceFor } from '@/services/experience';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import type { Experience } from '@/types/persona';

/**
 * The signed-in user's resolved persona: capabilities, permissions, occasion,
 * vocabulary. Returns the same object for the same persona, so it is safe to
 * use in render and in dependency lists.
 */
export function useExperience(): Experience {
  const account = useAccount();
  const occasions = useDb((s) => s.occasions);
  const { project } = useCustomerWorkspace(account.id);
  return experienceFor(account, { project: account.role === 'customer' ? project : null, occasions });
}
