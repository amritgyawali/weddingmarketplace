import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PALETTES, type Palette } from '@/constants/theme';
import { usePrefs, type Appearance } from '@/i18n';
import { useRoleTheme } from '@/theme/RoleTheme';

import { triggerHaptic } from './PressableScale';
import { Text } from './Text';
import { toast } from './Toast';

type IconName = keyof typeof Ionicons.glyphMap;

const OPTIONS: { id: Appearance; label: string; hint: string; icon: IconName }[] = [
  { id: 'light', label: 'Light', hint: 'Ivory and burgundy', icon: 'sunny-outline' },
  { id: 'dark', label: 'Dark', hint: 'Easy on the eyes at night', icon: 'moon-outline' },
  { id: 'system', label: 'Same as phone', hint: 'Follows your phone setting', icon: 'phone-portrait-outline' },
];

const TOAST: Record<Appearance, string> = {
  light: 'Light mode on',
  dark: 'Dark mode on',
  system: 'Following your phone',
};

/** Saves the choice on this device and says so. The root layout repaints every screen. */
function useChoose() {
  const appearance = usePrefs((s) => s.appearance) ?? 'system';
  const setAppearance = usePrefs((s) => s.setAppearance);
  const choose = (next: Appearance) => {
    if (next === appearance) return;
    triggerHaptic('selection');
    setAppearance(next);
    toast(TOAST[next], next === 'dark' ? 'moon-outline' : next === 'light' ? 'sunny-outline' : 'phone-portrait-outline', 'info');
  };
  return { appearance, choose };
}

/** A tiny screen drawn in one palette: background, a card with two lines of text and a burgundy button. */
function MiniScreen({ p, style }: { p: Palette; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.mini, { backgroundColor: p.bg }, style]}>
      <View style={[styles.miniBand, { backgroundColor: p.wine, borderColor: p.goldLine }]}>
        <View style={[styles.miniLine, { width: '55%', backgroundColor: p.onDark }]} />
        <View style={[styles.miniRule, { backgroundColor: p.gold }]} />
      </View>
      <View style={[styles.miniCard, { backgroundColor: p.white, borderColor: p.border }]}>
        <View style={[styles.miniLine, { width: '70%', backgroundColor: p.heading }]} />
        <View style={[styles.miniLine, { width: '45%', backgroundColor: p.textMuted, opacity: 0.8 }]} />
      </View>
      <View style={[styles.miniButton, { backgroundColor: p.primary }]} />
    </View>
  );
}

/**
 * Light, dark or "same as phone", with a small preview of each. The choice is
 * kept on this device and repaints the whole app at once (every role).
 */
export function AppearancePicker() {
  const t = useRoleTheme();
  const { appearance, choose } = useChoose();
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const on = appearance === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => choose(o.id)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.label}. ${o.hint}`}
            style={({ pressed }) => [styles.tile, { borderColor: on ? t.c.primary : t.c.border, backgroundColor: t.c.surface }, on && styles.tileOn, pressed && { opacity: 0.8 }]}>
            {o.id === 'system' ? (
              <View style={styles.split}>
                <MiniScreen p={PALETTES.light} style={styles.half} />
                <MiniScreen p={PALETTES.dark} style={styles.half} />
              </View>
            ) : (
              <MiniScreen p={PALETTES[o.id]} />
            )}
            <View style={styles.label}>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={16} color={on ? t.c.primary : t.c.subtle} />
              <Text size={13} weight={on ? 'semibold' : 'medium'} color={t.c.textStrong} numberOfLines={1} style={{ flexShrink: 1 }}>
                {o.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** One line under the picker: what the current choice does. */
export function AppearanceHint() {
  const t = useRoleTheme();
  const appearance = usePrefs((s) => s.appearance) ?? 'system';
  const hint = OPTIONS.find((o) => o.id === appearance)?.hint ?? '';
  return (
    <Text size={12} color={t.c.muted}>
      {hint}
    </Text>
  );
}

/** Sun / moon / phone switch for profile pages and headers. */
export function AppearanceSwitch({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useRoleTheme();
  const { appearance, choose } = useChoose();
  return (
    <View style={[styles.switch, { borderColor: t.c.border, backgroundColor: t.c.surface }, style]} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const on = appearance === o.id;
        return (
          <Pressable
            key={o.id}
            onPress={() => choose(o.id)}
            hitSlop={4}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            style={({ pressed }) => [styles.switchOption, on && { backgroundColor: t.c.textStrong }, pressed && !on && { opacity: 0.6 }]}>
            <Ionicons name={o.icon} size={16} color={on ? t.c.surface : t.c.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  tile: { flex: 1, borderWidth: 1, borderRadius: 10, padding: 8, gap: 8 },
  tileOn: { borderWidth: 2, padding: 7 },
  mini: { height: 92, borderRadius: 6, padding: 6, gap: 5, overflow: 'hidden' },
  split: { flexDirection: 'row', height: 92, borderRadius: 6, overflow: 'hidden' },
  half: { flex: 1, borderRadius: 0 },
  miniBand: { borderRadius: 4, borderWidth: 1, padding: 5, gap: 4 },
  miniCard: { borderRadius: 4, borderWidth: 1, padding: 5, gap: 4 },
  miniLine: { height: 4, borderRadius: 2 },
  miniRule: { width: 14, height: 1 },
  miniButton: { height: 10, width: '60%', borderRadius: 3 },
  label: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  switch: { flexDirection: 'row', borderWidth: 1, borderRadius: 16, padding: 2, gap: 2, alignSelf: 'flex-start' },
  switchOption: { width: 34, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
