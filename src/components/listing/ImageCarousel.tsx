import { Photo } from '@/components/ui/Photo';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { photo, type PhotoRef } from '@/constants/images';
import { colors } from '@/constants/theme';

/** Swipeable photo strip with pagination dots (venue cards & detail heroes). */
export function ImageCarousel({
  images,
  width,
  height,
  radius = 0,
  onPressImage,
  dotsBottom = 12,
}: {
  images: PhotoRef[];
  width: number;
  height: number;
  radius?: number;
  onPressImage?: (index: number) => void;
  dotsBottom?: number;
}) {
  const [index, setIndex] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== index) setIndex(next);
  };

  return (
    <View style={{ width, height, borderRadius: radius, overflow: 'hidden', backgroundColor: colors.bgMuted }}>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item, i) => `${item}-${i}`}
        onScroll={onScroll}
        scrollEventThrottle={32}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item, index: i }) => (
          <Pressable onPress={() => onPressImage?.(i)} disabled={!onPressImage}>
            <Photo source={photo(item)} style={{ width, height }} contentFit="cover" transition={200} recyclingKey={`${item}-${i}`} />
          </Pressable>
        )}
      />
      {images.length > 1 && (
        <View style={[styles.dots, { bottom: dotsBottom, pointerEvents: 'none' }]}>
          {images.map((img, i) => (
            <View key={`${img}-${i}`} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.onWineMuted },
  /** The current photo: a champagne pill, so it reads on light and dark photos alike. */
  dotActive: { width: 20, backgroundColor: colors.gold },
});
