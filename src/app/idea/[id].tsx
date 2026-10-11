import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { FlatList, Pressable, Share, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photo as photoSource } from '@/constants/images';
import { colors, themed } from '@/constants/theme';
import { IDEA_PHOTOS } from '@/data/ideas';
import { useLiveList } from '@/hooks/useContent';
import { useAppStore } from '@/store/useAppStore';

/** Full-screen swipeable photo viewer for the Ideas feed. */
export default function IdeaViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ideas = useLiveList('idea', IDEA_PHOTOS);
  const startIndex = Math.max(0, ideas.findIndex((p) => p.id === id));
  const [index, setIndex] = useState(startIndex);
  const photo = ideas[index] ?? ideas[0];
  const liked = useAppStore((s) => s.likedPhotos.includes(photo.id));
  const toggleLike = useAppStore((s) => s.toggleLike);

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <FlatList
        data={ideas}
        horizontal
        pagingEnabled
        initialScrollIndex={startIndex}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(p) => p.id}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <Photo source={photoSource(item.image)} style={{ width, height }} contentFit="contain" transition={150} />
        )}
      />

      <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent']} style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Close" style={styles.circle}>
          <Ionicons name="close" size={24} color={colors.onDark} />
        </Pressable>
        <Text size={14} color={colors.onDark}>
          {index + 1} / {ideas.length}
        </Text>
        <Pressable
          onPress={() => Share.share({ message: `${photo.title} — wedding inspiration` }).catch(() => {})}
          hitSlop={12}
          accessibilityLabel="Share"
          style={styles.circle}>
          <Ionicons name="share-outline" size={22} color={colors.onDark} />
        </Pressable>
      </LinearGradient>

      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={[styles.bottom, { paddingBottom: insets.bottom + 18 }]}>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="medium" color={colors.textMuted}>
            {photo.category}
          </Text>
          <Text size={18} weight="semibold" color={colors.onDark} style={{ marginTop: 4 }}>
            {photo.title}
          </Text>
          <Text size={13} color="rgba(255,255,255,0.75)" style={{ marginTop: 2 }}>
            Photo: {photo.credit}
          </Text>
        </View>
        <Pressable
          onPress={() => {
            triggerHaptic(liked ? 'light' : 'success');
            toggleLike(photo.id);
          }}
          accessibilityLabel={liked ? 'Unlike' : 'Like'}
          style={styles.like}>
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={28} color={liked ? colors.primary : colors.onDark} />
          <Text size={13} weight="semibold" color={colors.onDark}>
            {photo.likes + (liked ? 1 : 0)}
          </Text>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  top: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  circle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  like: { alignItems: 'center', gap: 2 },
}));
