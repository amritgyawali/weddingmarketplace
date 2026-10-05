import { router } from 'expo-router';

import type { PhotoRef } from '@/constants/images';
import { useDb } from '@/store/useDb';
import { useAccount, useSession } from '@/store/useSession';

/**
 * Opens (or reuses) a direct enquiry thread between the signed-in couple and a
 * listing. Claimed listings reach the vendor account; unclaimed ones get a
 * simulated reply so couples always hear back.
 */
export function useStartChat() {
  const account = useAccount();
  const openThread = useDb((s) => s.openThread);
  return (listing: { id: string; name: string; image?: PhotoRef }, navigate = true) => {
    const owner = useSession.getState().accounts.find((a) => a.role === 'vendor' && a.listingId === listing.id);
    const id = openThread({
      kind: 'direct',
      listingId: listing.id,
      title: listing.name,
      image: listing.image,
      members: [
        { id: account.id, name: account.name, role: 'customer' },
        owner ? { id: owner.id, name: owner.businessName ?? owner.name, role: 'vendor' } : { id: `listing_${listing.id}`, name: listing.name, role: 'vendor' },
      ],
    });
    if (navigate) router.push({ pathname: '/inbox/[id]', params: { id } });
    return id;
  };
}
