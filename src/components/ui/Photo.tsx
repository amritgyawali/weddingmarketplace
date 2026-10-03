import { Image, type ImageProps } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';

import { colors, motion } from '@/constants/theme';

/**
 * Every photo in the app. Sits on a pearl fill while it loads and
 * cross-dissolves in instead of popping, so lists and galleries feel calm;
 * with Reduce Motion on it simply appears. Takes every `expo-image` prop,
 * and a caller's own `transition` or background wins.
 */
export function Photo({ style, transition, contentFit = 'cover', ...rest }: ImageProps) {
  const reduced = useReducedMotion();
  return (
    <Image
      contentFit={contentFit}
      transition={transition ?? (reduced ? null : { duration: motion.base, effect: 'cross-dissolve' })}
      style={[{ backgroundColor: colors.bgMuted }, style]}
      {...rest}
    />
  );
}
