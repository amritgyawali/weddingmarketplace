import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BRAND } from '@/constants/brand';
import { photos } from '@/constants/images';
import { gradients, shadows } from '@/constants/theme';

import { SparkleIcon } from './Icons';
import { PressableScale } from './PressableScale';

/**
 * Gradient-ringed assistant avatar. Used as the floating action button
 * (size 58) and inline next to search bars (size 40).
 */
export function GenieAvatar({ size = 58, sparkle = true, ring = 2.5 }: { size?: number; sparkle?: boolean; ring?: number }) {
  return (
    <LinearGradient
      colors={gradients.genieRing}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={{ width: size, height: size, borderRadius: size / 2, padding: ring }}>
      <View style={styles.innerRow}>
        <Image
          source={photos.assistantFace}
          style={{ width: size * 0.5, height: size * 0.5, borderRadius: size * 0.25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }}
          contentFit="cover"
        />
      </View>
      {sparkle && (
        <View style={[styles.sparkle, { right: size * 0.1, top: size * 0.26 }]}>
          <SparkleIcon size={size * 0.2} />
          <View style={{ marginLeft: size * 0.08, marginTop: -size * 0.02 }}>
            <SparkleIcon size={size * 0.11} />
          </View>
        </View>
      )}
    </LinearGradient>
  );
}

export function GenieFab({ style, bottom = 16 }: { style?: StyleProp<ViewStyle>; bottom?: number }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.set(withRepeat(
      withSequence(
        withTiming(1.06, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    ));
  }, [pulse]);

  const glow = useAnimatedStyle(() => ({ transform: [{ scale: pulse.get() }] }));

  return (
    <Animated.View style={[styles.fab, { bottom }, glow, style]}>
      <PressableScale
        haptic
        activeScale={0.9}
        accessibilityLabel={`Chat with ${BRAND.assistantTitle}`}
        onPress={() => router.push('/assistant')}
        style={[styles.shadow]}>
        <GenieAvatar size={62} />
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  innerRow: { flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingRight: '14%' },
  sparkle: { position: 'absolute', flexDirection: 'row', alignItems: 'flex-start' },
  fab: { position: 'absolute', right: 16, zIndex: 20 },
  shadow: { borderRadius: 40, ...shadows.fab },
});
