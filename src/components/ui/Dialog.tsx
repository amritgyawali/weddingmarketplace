import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { create } from 'zustand';

import { colors, radius, shadows } from '@/constants/theme';

import { triggerHaptic } from './PressableScale';
import { Text } from './Text';

interface DialogRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  /** Red confirm button (delete, remove, cancel a booking). Inferred from the label when unset. */
  destructive?: boolean;
}

const useDialog = create<{ current: DialogRequest | null }>(() => ({ current: null }));

const DESTRUCTIVE = /delete|remove|cancel|log out|sign out|reset|discard|decline|reject|suspend|clear|withdraw|hide/i;

/** Opens the app's confirmation dialog (same look on iOS, Android and web). */
export function openDialog(request: DialogRequest) {
  useDialog.setState({ current: request });
}

/** Mounted once at the root; shows the current confirmation. */
export function DialogHost() {
  const current = useDialog((s) => s.current);
  if (!current) return null;
  const destructive = current.destructive ?? DESTRUCTIVE.test(current.confirmLabel);
  const close = () => useDialog.setState({ current: null });

  return (
    <Modal visible transparent statusBarTranslucent navigationBarTranslucent animationType="none" onRequestClose={() => { close(); current.onCancel?.(); }}>
      <Animated.View entering={FadeIn.duration(140)} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { close(); current.onCancel?.(); }} accessibilityLabel="Cancel" />
        <Animated.View entering={ZoomIn.duration(180)} style={styles.card} accessibilityRole="alert">
          <View style={[styles.icon, { backgroundColor: destructive ? '#FBE9E9' : '#EEF1F5' }]}>
            <Ionicons name={destructive ? 'alert-circle-outline' : 'help-circle-outline'} size={24} color={destructive ? colors.danger : colors.heading} />
          </View>
          <Text size={18} weight="bold" color={colors.heading} align="center">
            {current.title}
          </Text>
          {!!current.message && (
            <Text size={14} color={colors.textBody} align="center">
              {current.message}
            </Text>
          )}
          <View style={styles.actions}>
            <Pressable
              onPress={() => {
                close();
                current.onCancel?.();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.secondary, pressed && { opacity: 0.7 }]}>
              <Text size={15} weight="semibold" color={colors.heading}>
                {current.cancelLabel ?? 'Cancel'}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                close();
                triggerHaptic(destructive ? 'medium' : 'light');
                current.onConfirm();
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, { backgroundColor: destructive ? colors.danger : colors.heading }, pressed && { opacity: 0.8 }]}>
              <Text size={15} weight="semibold" color={colors.white} numberOfLines={1}>
                {current.confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,18,16,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: colors.white, borderRadius: radius.lg, padding: 22, gap: 8, alignItems: 'center', ...shadows.raised },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12, alignSelf: 'stretch' },
  button: { flex: 1, height: 46, borderRadius: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  secondary: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
});
