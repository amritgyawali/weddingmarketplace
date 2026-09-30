import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER } from '@/constants/theme';
import { useStory } from '@/hooks/queries';

export default function StoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: story, isLoading, error } = useStory(id);

  return (
    <View style={styles.root}>
      <ScreenHeader
        title="Stories"
        right={
          story ? (
            <IconButton icon="share-social-outline" accessibilityLabel="Share story" onPress={() => Share.share({ message: story.title }).catch(() => {})} />
          ) : undefined
        }
      />
      {isLoading ? (
        <View style={{ padding: GUTTER, gap: 12 }}>
          <Skeleton height={220} />
          <Skeleton width="80%" height={24} />
          <Skeleton height={100} />
        </View>
      ) : error || !story ? (
        <EmptyState title="Story not found" actionLabel="Back to ideas" onAction={() => router.back()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Image source={photos[story.image]} style={{ width, height: width * 0.66 }} contentFit="cover" />
          <View style={styles.body}>
            <Text size={12} weight="medium" color={colors.textMuted}>
              {story.category}
            </Text>
            <Text serif size={24} weight="bold" color={colors.heading} lineHeight={34}>
              {story.title}
            </Text>
            <Text size={13} color={colors.textMuted}>
              By {story.author} · {story.readMinutes} min read
            </Text>
            <Text size={17} weight="medium" color={colors.textBody} lineHeight={26} style={{ marginTop: 8 }}>
              {story.excerpt}
            </Text>
            {story.body.map((p, i) => (
              <Text key={i} size={16} color={colors.text} lineHeight={26}>
                {p}
              </Text>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER, gap: 12 },
});
