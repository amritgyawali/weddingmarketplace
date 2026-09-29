import { router } from 'expo-router';
import { View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { colors } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <ScreenHeader title="Not found" />
      <EmptyState
        icon="compass-outline"
        title="This page doesn't exist"
        message="The link may be broken or the page may have moved."
        actionLabel="Go to home"
        onAction={() => router.replace('/')}
      />
    </View>
  );
}
