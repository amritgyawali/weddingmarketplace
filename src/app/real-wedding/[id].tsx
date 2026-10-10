import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { EmptyState } from '@/components/ui/EmptyState';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { Text } from '@/components/ui/Text';
import { photo } from '@/constants/images';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useRealWedding } from '@/hooks/queries';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

export default function RealWeddingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const { data: wedding, isLoading, error } = useRealWedding(id);
  const tile = (width - GUTTER * 2 - 8) / 2;
  const [viewing, setViewing] = useState<number | null>(null);

  return (
    <View style={styles.root}>
      <ScreenHeader title="Real Wedding" />
      {isLoading ? (
        <View style={{ padding: GUTTER, gap: 12 }}>
          <Skeleton height={260} />
          <Skeleton width="60%" height={24} />
        </View>
      ) : error || !wedding ? (
        <EmptyState title="Wedding not found" actionLabel="Back" onAction={() => router.back()} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <Photo source={photo(wedding.cover)} style={{ width, height: width * 0.8 }} contentFit="cover" />
          <View style={styles.body}>
            <Text serif size={26} weight="bold" color={colors.heading} lineHeight={36}>
              {wedding.couple}
            </Text>
            <View style={styles.meta}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <Text size={14} color={colors.textMuted}>
                {wedding.venue}, {wedding.city}
              </Text>
            </View>
            <View style={styles.theme}>
              <Text size={12} weight="medium" color={colors.textMuted}>
                {wedding.theme} theme
              </Text>
            </View>
            <Text size={16} color={colors.text} lineHeight={25} style={{ marginTop: 8 }}>
              {wedding.story}
            </Text>

            <Text size={19} weight="bold" color={colors.heading} style={{ marginTop: 16 }}>
              Gallery
            </Text>
            <View style={styles.gallery}>
              {wedding.gallery.map((g, i) => (
                <Pressable key={`${g}${i}`} onPress={() => setViewing(i)} accessibilityRole="button" accessibilityLabel={`Open photo ${i + 1} of ${wedding.gallery.length}`}>
                  <Photo source={photo(g)} style={{ width: tile, height: tile * 1.25, borderRadius: radius.md }} contentFit="cover" />
                </Pressable>
              ))}
            </View>
            <PhotoViewer sources={wedding.gallery.map((g) => photo(g))} index={viewing} onClose={() => setViewing(null)} />

            <Text size={19} weight="bold" color={colors.heading} style={{ marginTop: 16 }}>
              Vendors they loved
            </Text>
            {wedding.vendors.map((v) => (
              <View key={v.role} style={styles.vendor}>
                <Text size={14} color={colors.textMuted} style={{ width: 110 }}>
                  {v.role}
                </Text>
                <Text size={15} weight="semibold" color={colors.heading} style={{ flex: 1 }}>
                  {v.name}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER, gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  theme: { alignSelf: 'flex-start', backgroundColor: colors.primarySoft, borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  vendor: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
});
