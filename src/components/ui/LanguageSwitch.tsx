import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { usePrefs, type Lang } from '@/i18n';
import { useRoleTheme } from '@/theme/RoleTheme';

import { triggerHaptic } from './PressableScale';
import { Text } from './Text';
import { toast } from './Toast';

const OPTIONS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'ne', label: 'नेपाली' },
];

/**
 * English / नेपाली switch. The whole app changes language at once; the
 * choice is kept on this device. `compact` is the small pill for headers.
 */
export function LanguageSwitch({ compact, onChange, style }: { compact?: boolean; onChange?: (lang: Lang) => void; style?: StyleProp<ViewStyle> }) {
  const t = useRoleTheme();
  const lang = usePrefs((s) => s.lang);
  const setLang = usePrefs((s) => s.setLang);
  return (
    <View style={[styles.wrap, { borderColor: t.c.border, backgroundColor: t.c.surface }, compact && styles.compact, style]} accessibilityRole="radiogroup">
      {OPTIONS.map((o) => {
        const on = lang === o.id;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={o.label}
            hitSlop={6}
            onPress={() => {
              if (on) return;
              triggerHaptic('selection');
              setLang(o.id);
              onChange?.(o.id);
              toast(o.id === 'ne' ? 'भाषा नेपालीमा परिवर्तन भयो' : 'Language changed to English', 'language-outline', 'info');
            }}
            style={({ pressed }) => [styles.option, compact && styles.optionCompact, on && { backgroundColor: t.c.textStrong }, pressed && !on && { opacity: 0.6 }]}>
            <Text size={compact ? 12 : 14} weight={on ? 'semibold' : 'regular'} color={on ? t.c.surface : t.c.text} raw>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', borderWidth: 1, borderRadius: 8, padding: 3, alignSelf: 'flex-start', gap: 2 },
  compact: { borderRadius: 16, padding: 2 },
  option: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 6, minWidth: 80, alignItems: 'center' },
  optionCompact: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 14, minWidth: 0 },
});
