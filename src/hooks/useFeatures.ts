import { featureOn, linkOn, type FeatureLink } from '@/data/features';
import { useDb } from '@/store/useDb';

/** `on('home.venues')`: is a feature switched on (super admin console)? Missing ids take their default. */
export function useFeatures() {
  const flags = useDb((s) => s.featureFlags);
  return (id: string) => featureOn(flags, id);
}

/** `linkOn('/seating')`: does this link lead to a screen that is switched on? Use it to drop menu rows and buttons. */
export function useLinkOn() {
  const flags = useDb((s) => s.featureFlags);
  return (href: FeatureLink) => linkOn(flags, href);
}
