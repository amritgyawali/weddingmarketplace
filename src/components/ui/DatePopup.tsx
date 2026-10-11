import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { colors, radius, themed } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

import { Calendar } from './Calendar';
import { IconButton } from './IconButton';
import { Text } from './Text';

/**
 * A date picker that opens as a centred popup over the screen (or over a
 * sheet), so the person never has to scroll down to find the calendar.
 * Picking a day closes it.
 */
export function DatePopup({
  visible,
  title = 'Pick a date',
  value,
  onChange,
  onClose,
  minDate,
}: {
  visible: boolean;
  title?: string;
  value: string | null;
  onChange: (iso: string) => void;
  onClose: () => void;
  minDate?: Date;
}) {
  const t = useRoleTheme();
  return (
    <Modal visible={visible} transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={onClose}>
      {visible && (
        <Animated.View entering={FadeIn.duration(140)} style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
          <Animated.View entering={ZoomIn.duration(180)} style={[styles.card, { backgroundColor: t.c.surface }]} accessibilityViewIsModal>
            <View style={styles.header}>
              <Text size={17} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
                {title}
              </Text>
              <IconButton icon="close" size={34} iconSize={22} accessibilityLabel="Close" onPress={onClose} color={t.c.textStrong} />
            </View>
            <Calendar
              value={value}
              minDate={minDate}
              onChange={(d) => {
                onChange(d);
                onClose();
              }}
            />
          </Animated.View>
        </Animated.View>
      )}
    </Modal>
  );
}

const styles = themed(() => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 420, borderRadius: radius.lg, padding: 14, paddingTop: 8, gap: 4 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
}));
