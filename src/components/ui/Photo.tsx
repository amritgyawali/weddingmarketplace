import { Image, type ImageProps } from 'expo-image';
import { useReducedMotion } from 'react-native-reanimated';

import { photoKeyOf } from '@/constants/images';
import { colors, motion } from '@/constants/theme';
import { useContent } from '@/hooks/useContent';
import { LOCAL_IMAGE_SCHEME } from '@/services/content';
import { imageUri } from '@/utils/localImage';

type Source = ImageProps['source'];

const isLocal = (source: Source): source is { uri: string } =>
  !!source && typeof source === 'object' && 'uri' in source && typeof source.uri === 'string' && source.uri.startsWith(LOCAL_IMAGE_SCHEME);

/**
 * Every photo in the app. Sits on a pearl fill while it loads and
 * cross-dissolves in instead of popping, so lists and galleries feel calm;
 * with Reduce Motion on it simply appears. Takes every `expo-image` prop,
 * and a caller's own `transition` or background wins.
 *
 * A bundled photo a super admin replaced (Content studio → Photos) shows the
 * replacement here, so the swap reaches every screen at once.
 */
export function Photo({ style, transition, contentFit = 'cover', source, ...rest }: ImageProps) {
  const reduced = useReducedMotion();
  const images = useContent().images;
  const key = photoKeyOf(source);
  const replacement = key ? images[key] : undefined;
  const shown: Source = replacement ? { uri: imageUri(replacement) } : isLocal(source) ? { ...source, uri: imageUri(source.uri) } : source;
  return (
    <Image
      contentFit={contentFit}
      transition={transition ?? (reduced ? null : { duration: motion.base, effect: 'cross-dissolve' })}
      style={[{ backgroundColor: colors.bgMuted }, style]}
      source={shown}
      {...rest}
    />
  );
}
