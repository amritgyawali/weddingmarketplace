import { router } from 'expo-router';

import { tabFeature } from '@/data/features';
import { useFeatures } from '@/hooks/useFeatures';

/** Closes any screens stacked over the couple tabs, then switches to `tab`, instead of pushing a second set of tabs. */
export function goToCoupleTab(tab: '/' | '/wedding') {
  if (router.canDismiss()) router.dismissAll();
  router.navigate(tab);
}

/** Opens the couple's plan: the "My wedding" tab, or the stack screen when a super admin has switched the tab off. */
export function useOpenMyWedding(): () => void {
  const on = useFeatures();
  return () => (on(tabFeature('customer', 'wedding')) ? goToCoupleTab('/wedding') : router.push('/my-wedding'));
}
