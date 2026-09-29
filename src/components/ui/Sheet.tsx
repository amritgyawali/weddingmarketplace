import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

import { IconButton } from './IconButton';
import { Text } from './Text';

/** Lightweight bottom sheet built on Modal + Reanimated layout animations. */
export function Sheet({
  visible,
  onClose,
  title,
  children,
  footer,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const t = useRoleTheme();

  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      {visible && (
        <View style={styles.root}>
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(160)} style={StyleSheet.absoluteFill}>
            <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
          </Animated.View>
          <Animated.View
            entering={SlideInDown.springify().damping(20).stiffness(180)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), backgroundColor: t.c.surface }]}>
            <View style={[styles.handle, { backgroundColor: t.c.border }]} />
            {title && (
              <View style={styles.header}>
                <Text weight="bold" size={19} color={t.c.textStrong}>
                  {title}
                </Text>
                <IconButton icon="close" size={32} iconSize={18} accessibilityLabel="Close" onPress={onClose} background={t.c.surfaceAlt} color={t.c.textStrong} />
              </View>
            )}
            {children}
            {footer}
          </Animated.View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl + 4,
    borderTopRightRadius: radius.xl + 4,
    maxHeight: '88%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.hairline,
    marginTop: 8,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
});
