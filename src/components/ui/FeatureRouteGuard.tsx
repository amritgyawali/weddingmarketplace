import { router, usePathname, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { colors, themed } from '@/constants/theme';
import { featureForPath } from '@/data/features';
import { useFeatures } from '@/hooks/useFeatures';
import { useSession } from '@/store/useSession';
import type { UserRole } from '@/types/platform';

import { EmptyState } from './EmptyState';

const HOME: Record<UserRole, Href> = { customer: '/', vendor: '/business', freelancer: '/freelancer', platform: '/platform' };

/**
 * Covers a screen whose feature a super admin switched off (or that is an
 * extra not switched on yet), so old links, notifications and typed URLs
 * can't open it. Menus already hide the links; this is the safety net.
 */
export function FeatureRouteGuard() {
  const path = usePathname();
  const on = useFeatures();
  const role = useSession((s) => s.session?.role ?? null);
  const id = featureForPath(path);
  if (!id || on(id)) return null;
  const leave = () => (router.canGoBack() ? router.back() : router.replace(role ? HOME[role] : '/'));
  return (
    <View style={styles.cover} accessibilityViewIsModal>
      <EmptyState icon="eye-off-outline" title="This isn’t available right now" message="Vivah has switched this part of the app off. Anything you saved here is kept." actionLabel="Go back" onAction={leave} />
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  cover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', padding: 24 },
}));
