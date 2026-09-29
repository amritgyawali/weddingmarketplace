import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radius, shadows } from '@/constants/theme';

import { Text } from './Text';

type ToastIcon = ComponentProps<typeof Ionicons>['name'];

interface ToastState {
  message: string | null;
  icon: ToastIcon;
  key: number;
  show: (message: string, icon?: ToastIcon) => void;
}

let hideTimer: ReturnType<typeof setTimeout> | undefined;

const useToastStore = create<ToastState>((set) => ({
  message: null,
  icon: 'checkmark-circle',
  key: 0,
  show: (message, icon = 'checkmark-circle') => {
    clearTimeout(hideTimer);
    set((s) => ({ message, icon, key: s.key + 1 }));
    hideTimer = setTimeout(() => set({ message: null }), 2200);
  },
}));

/** Fire-and-forget confirmation, e.g. `toast('Added to shortlist')`. */
export const toast = (message: string, icon?: ToastIcon) => useToastStore.getState().show(message, icon);

export function ToastHost() {
  const { message, icon, key } = useToastStore();
  const insets = useSafeAreaInsets();
  if (!message) return null;

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.host, { paddingBottom: insets.bottom + 90 }]}>
      <Animated.View key={key} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)} style={styles.toast}>
        <Ionicons name={icon} size={20} color={colors.white} />
        <Text size={14} weight="semibold" color={colors.white}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: 'flex-end', alignItems: 'center', zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#2B2B2E',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
    ...shadows.raised,
  },
});
