import { Ionicons } from '@expo/vector-icons';
import type { ImageProps } from 'expo-image';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

import { Photo } from './Photo';
import { Text } from './Text';

/**
 * Full-screen photo viewer: swipe between photos on black, "3 / 8" at the
 * top and a close (X) button. Opens at `index`; Android back also closes it.
 */
export function PhotoViewer({
  sources,
  index,
  onClose,
}: {
  sources: ImageProps['source'][];
  /** The photo to open at, or null when the viewer is closed. */
  index: number | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState(index ?? 0);
  const [openedAt, setOpenedAt] = useState(index);
  const visible = index !== null;
  // Opened again (or at another photo): start the counter at that photo.
  if (index !== openedAt) {
    setOpenedAt(index);
    if (index !== null) setCurrent(index);
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / width);
    if (next !== current && next >= 0 && next < sources.length) setCurrent(next);
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} supportedOrientations={['portrait', 'landscape']}>
      <View style={styles.root} accessibilityViewIsModal>
        {visible && (
          <FlatList
            data={sources}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={Math.min(index ?? 0, Math.max(sources.length - 1, 0))}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            keyExtractor={(_, i) => String(i)}
            onScroll={onScroll}
            scrollEventThrottle={32}
            renderItem={({ item, index: i }) => (
              <View style={{ width, height, justifyContent: 'center' }}>
                <Photo source={item} style={{ width, height: height - insets.top - insets.bottom - 120 }} contentFit="contain" transition={150} recyclingKey={`viewer-${i}`} accessibilityLabel={`Photo ${i + 1} of ${sources.length}`} />
              </View>
            )}
          />
        )}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Text size={15} weight="semibold" color={colors.white} numeric>
            {sources.length ? `${current + 1} / ${sources.length}` : ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close photos" style={({ pressed }) => [styles.close, pressed && { opacity: 0.7 }]}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  top: { position: 'absolute', left: 0, right: 0, top: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
});
