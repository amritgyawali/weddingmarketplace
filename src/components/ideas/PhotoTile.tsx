import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring } from 'react-native-reanimated';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import type { IdeaPhoto } from '@/types';

/** Grid photo with a like counter, for the Ideas feed. */
export const PhotoTile = memo(function PhotoTile({ photo, width }: { photo: IdeaPhoto; width: number }) {
  const liked = useAppStore((s) => s.likedPhotos.includes(photo.id));
  const toggleLike = useAppStore((s) => s.toggleLike);
  const scale = useSharedValue(1);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const like = () => {
    const now = toggleLike(photo.id);
    triggerHaptic(now ? 'success' : 'light');
    scale.set(withSequence(withSpring(1.2, { damping: 10 }), withSpring(1)));
  };

  // The like button sits beside the photo button, not inside it (nested buttons are invalid on web).
  return (
    <View style={{ width, height: width / photo.aspect }}>
      <Pressable
        onPress={() => router.push({ pathname: '/idea/[id]', params: { id: photo.id } })}
        accessibilityLabel={photo.title}
        style={StyleSheet.absoluteFill}>
        <Photo source={photos[photo.image]} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} recyclingKey={photo.id} />
      </Pressable>
      <Pressable onPress={like} hitSlop={8} accessibilityLabel={liked ? 'Unlike photo' : 'Like photo'} style={styles.likes}>
        <Animated.View style={heartStyle}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={18} color={colors.white} />
        </Animated.View>
        <Text size={13} weight="medium" color={colors.white}>
          {photo.likes + (liked ? 1 : 0)}
        </Text>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  likes: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(20,16,12,0.55)',
    borderRadius: 4,
  },
});
