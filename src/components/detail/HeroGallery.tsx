import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ImageCarousel } from '@/components/listing/ImageCarousel';
import { PhotoViewer } from '@/components/ui/PhotoViewer';
import { Text } from '@/components/ui/Text';
import { photos, type PhotoKey } from '@/constants/images';
import { colors, radius } from '@/constants/theme';

/**
 * The photo strip at the top of a venue or vendor page, with a "12 photos"
 * badge. Tapping a photo or the badge opens every photo full screen, with a
 * close (X) button.
 */
export function HeroGallery({ images, width, height }: { images: PhotoKey[]; width: number; height: number }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <View>
      <ImageCarousel images={images} width={width} height={height} dotsBottom={16} onPressImage={setOpen} />
      {images.length > 0 && (
        <Pressable onPress={() => setOpen(0)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`View all ${images.length} photos`} style={({ pressed }) => [styles.count, pressed && { opacity: 0.8 }]}>
          <Ionicons name="images-outline" size={14} color={colors.onDark} />
          <Text size={12} weight="semibold" color={colors.onDark}>
            {images.length} {images.length === 1 ? 'photo' : 'photos'}
          </Text>
          <Ionicons name="expand-outline" size={13} color={colors.onDark} />
        </Pressable>
      )}
      <PhotoViewer sources={images.map((k) => photos[k])} index={open} onClose={() => setOpen(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  count: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(20,16,12,0.6)',
    borderRadius: radius.xs,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
