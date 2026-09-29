import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import type { IdeaPhoto } from '@/types';

/** Grid photo with the like counter pill from the Ideas feed. */
export const PhotoTile = memo(function PhotoTile({ photo, width }: { photo: IdeaPhoto; width: number }) {
  const liked = useAppStore((s) => s.likedPhotos.includes(photo.id));
  const toggleLike = useAppStore((s) => s.toggleLike);
  const scale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const like = () => {
    const now = toggleLike(photo.id);
    triggerHaptic(now ? 'success' : 'light');
    scale.set(withSequence(withSpring(1.35, { damping: 5 }), withSpring(1)));
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/idea/[id]', params: { id: photo.id } })}
      accessibilityLabel={photo.title}
      style={{ width, height: width / photo.aspect }}>
      <Image source={photos[photo.image]} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={photo.id} />
      <Pressable onPress={like} hitSlop={8} accessibilityLabel={liked ? 'Unlike photo' : 'Like photo'} style={styles.likes}>
        <Animated.View style={heartStyle}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? colors.primary : colors.white} />
        </Animated.View>
        <Text size={16} weight="medium" color={colors.white}>
          {photo.likes + (liked ? 1 : 0)}
        </Text>
      </Pressable>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  likes: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderTopLeftRadius: 6,
  },
});
