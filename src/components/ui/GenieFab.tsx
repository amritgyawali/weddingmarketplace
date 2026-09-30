import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { BRAND } from '@/constants/brand';
import { colors, shadows } from '@/constants/theme';

import { PressableScale } from './PressableScale';

/** Round help badge: a chat glyph on crimson. Stands in for the assistant wherever it is linked. */
export function GenieAvatar({ size = 40 }: { size?: number; sparkle?: boolean; ring?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name="chatbubble-ellipses-outline" size={size * 0.5} color={colors.primary} />
    </View>
  );
}

/** Small floating "Help" button. */
export function GenieFab({ style, bottom = 16 }: { style?: StyleProp<ViewStyle>; bottom?: number }) {
  return (
    <PressableScale
      accessibilityLabel={BRAND.assistantTitle}
      onPress={() => router.push('/assistant')}
      style={[styles.fab, { bottom }, style]}>
      <Ionicons name="chatbubble-ellipses-outline" size={22} color={colors.white} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 16,
    zIndex: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.heading,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.fab,
  },
});
