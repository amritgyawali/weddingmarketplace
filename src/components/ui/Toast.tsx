import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { colors, radius, shadows } from '@/constants/theme';
import { translate, useI18n } from '@/i18n';

import { Text } from './Text';

type ToastIcon = ComponentProps<typeof Ionicons>['name'];
export type ToastTone = 'success' | 'error' | 'info' | 'warning';

interface ToastState {
  message: string | null;
  icon: ToastIcon;
  tone: ToastTone;
  key: number;
  show: (message: string, icon?: ToastIcon, tone?: ToastTone) => void;
  hide: () => void;
}

let hideTimer: ReturnType<typeof setTimeout> | undefined;

const ERROR_ICONS = new Set<string>(['alert-circle', 'alert-circle-outline', 'close-circle', 'close-circle-outline', 'warning', 'warning-outline', 'lock-closed', 'lock-closed-outline']);
/** Messages that read as a refusal or a problem get the error style even without a tone. */
const LOOKS_LIKE_ERROR = /^(only|you can’t|you can't|you don’t|you don't|can’t|can't|cannot|enter|add a|pick|select|choose|give|keep|write|this .* (is|was) |not |no |invalid|please|something went wrong|failed|couldn’t|couldn't|too |the .* (is|must))/i;

function toneFor(message: string, icon: ToastIcon | undefined): ToastTone {
  if (icon && ERROR_ICONS.has(icon)) return icon.startsWith('warning') ? 'warning' : 'error';
  if (!icon && LOOKS_LIKE_ERROR.test(message.trim())) return 'error';
  return 'success';
}

const useToastStore = create<ToastState>((set) => ({
  message: null,
  icon: 'checkmark-circle',
  tone: 'success',
  key: 0,
  show: (message, icon, tone) => {
    clearTimeout(hideTimer);
    const resolved = tone ?? toneFor(message, icon);
    const glyph: ToastIcon = icon ?? (resolved === 'error' ? 'alert-circle' : resolved === 'warning' ? 'warning' : resolved === 'info' ? 'information-circle' : 'checkmark-circle');
    set((s) => ({ message, icon: glyph, tone: resolved, key: s.key + 1 }));
    // Errors stay up longer so there is time to read what to fix.
    hideTimer = setTimeout(() => set({ message: null }), resolved === 'error' || resolved === 'warning' ? 4200 : 2400);
  },
  hide: () => {
    clearTimeout(hideTimer);
    set({ message: null });
  },
}));

/** Fire-and-forget confirmation, e.g. `toast('Added to shortlist')`. Refusals ("Only…", "Enter…") show as errors. */
export const toast = (message: string, icon?: ToastIcon, tone?: ToastTone) => useToastStore.getState().show(message, icon, tone);
/** An error to show (red, stays longer). */
export const toastError = (message: string) => useToastStore.getState().show(message, undefined, 'error');
/** Neutral information. */
export const toastInfo = (message: string, icon?: ToastIcon) => useToastStore.getState().show(message, icon ?? 'information-circle', 'info');

let lastShown = 0;
/** When the last toast was shown, so automatic confirmations don't cover a screen's own message. */
export const lastToastAt = () => lastShown;
useToastStore.subscribe((s, prev) => {
  if (s.key !== prev.key) lastShown = Date.now();
});

const TONES: Record<ToastTone, { bg: string; accent: string }> = {
  success: { bg: colors.heading, accent: '#4CAF7A' },
  info: { bg: colors.heading, accent: '#8FB3E0' },
  warning: { bg: '#3A2E12', accent: '#E0B04C' },
  error: { bg: '#4A1515', accent: '#F07A7A' },
};

export function ToastHost() {
  const { message, icon, tone, key, hide } = useToastStore();
  const { lang, overrides } = useI18n();
  const insets = useSafeAreaInsets();
  if (!message) return null;
  const palette = TONES[tone];

  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, styles.host, { paddingBottom: insets.bottom + 90 }]}>
      <Animated.View key={key} entering={FadeInDown.duration(220)} exiting={FadeOutDown.duration(180)}>
        <Pressable
          onPress={hide}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          accessibilityLabel={translate(message, lang, overrides)}
          style={[styles.toast, { backgroundColor: palette.bg }]}>
          <View style={[styles.accent, { backgroundColor: palette.accent }]} />
          <Ionicons name={icon === 'sparkles' ? 'checkmark-circle' : icon} size={19} color={palette.accent} />
          <Text size={14} weight="medium" color={colors.white} style={{ flexShrink: 1 }}>
            {message}
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: 'flex-end', alignItems: 'center', zIndex: 100 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 12,
    borderRadius: radius.md,
    maxWidth: 440,
    marginHorizontal: 16,
    overflow: 'hidden',
    ...shadows.raised,
  },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
});
