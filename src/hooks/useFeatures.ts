import { featureOn } from '@/data/features';
import { useDb } from '@/store/useDb';

/** `on('home.venues')`: is a feature switched on (super admin console)? Missing ids are on. */
export function useFeatures() {
  const flags = useDb((s) => s.featureFlags);
  return (id: string) => featureOn(flags, id);
}
