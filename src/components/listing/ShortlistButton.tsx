import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { PressableScale, triggerHaptic } from '@/components/ui/PressableScale';
import { toast } from '@/components/ui/Toast';
import { colors, hitSlop, shadows } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

/** White round bookmark overlay used on venue & vendor imagery. */
export function ShortlistButton({
  kind,
  id,
  size = 36,
  style,
}: {
  kind: 'venues' | 'vendors';
  id: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const saved = useAppStore((s) => s.shortlist[kind].includes(id));
  const toggleShortlist = useAppStore((s) => s.toggleShortlist);
  const pop = useSharedValue(1);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <PressableScale
      hitSlop={hitSlop}
      activeScale={0.88}
      accessibilityLabel={saved ? 'Remove from shortlist' : 'Add to shortlist'}
      accessibilityState={{ selected: saved }}
      onPress={() => {
        const nowSaved = toggleShortlist(kind, id);
        triggerHaptic(nowSaved ? 'success' : 'light');
        pop.set(withSequence(withSpring(1.3, { damping: 6 }), withSpring(1)));
        toast(nowSaved ? 'Added to your shortlist' : 'Removed from shortlist', nowSaved ? 'bookmark' : 'bookmark-outline');
      }}
      style={[styles.btn, { width: size, height: size, borderRadius: size / 2 }, shadows.card, style]}>
      <Animated.View style={iconStyle}>
        <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={size * 0.5} color={saved ? colors.primary : colors.textStrong} />
      </Animated.View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: 'rgba(255,255,255,0.95)', alignItems: 'center', justifyContent: 'center' },
});
