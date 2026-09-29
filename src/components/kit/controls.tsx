import { Ionicons } from '@expo/vector-icons';
import { forwardRef, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { inputReset } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

import type { IconName } from './primitives';

export const KField = forwardRef<TextInput, TextInputProps & { label?: string; error?: string | null; prefix?: string }>(function KField(
  { label, error, prefix, style, multiline, ...rest },
  ref,
) {
  const t = useRoleTheme();
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text size={13} weight="semibold" color={t.c.muted}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.field,
          { backgroundColor: t.dark ? t.c.surfaceAlt : t.c.surface, borderColor: error ? t.c.danger : t.c.border, borderRadius: t.role === 'platform' ? 10 : 12 },
          multiline && { alignItems: 'flex-start', minHeight: 96 },
        ]}>
        {prefix && (
          <Text size={15} weight="semibold" color={t.c.muted}>
            {prefix}
          </Text>
        )}
        <TextInput
          ref={ref}
          placeholderTextColor={t.c.subtle}
          selectionColor={t.c.primary}
          multiline={multiline}
          style={[
            { flex: 1, fontFamily: t.fonts.regular, fontSize: 15, color: t.c.textStrong, paddingVertical: multiline ? 12 : 0, minHeight: 46, textAlignVertical: multiline ? 'top' : 'center' },
            inputReset,
            style,
          ]}
          {...rest}
        />
      </View>
      {!!error && (
        <Text size={12} color={t.c.danger}>
          {error}
        </Text>
      )}
    </View>
  );
});

/** Pill-style segmented control; scrolls horizontally when it overflows. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  counts,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  counts?: Partial<Record<T, number>>;
}) {
  const t = useRoleTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.segRow}>
      {options.map((o) => {
        const active = o.id === value;
        const count = counts?.[o.id];
        return (
          <Pressable
            key={o.id}
            onPress={() => {
              triggerHaptic('selection');
              onChange(o.id);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[
              styles.seg,
              {
                backgroundColor: active ? t.c.primary : t.c.surface,
                borderColor: active ? t.c.primary : t.c.border,
                borderRadius: t.role === 'platform' ? 8 : 999,
              },
            ]}>
            <Text size={13} weight="semibold" color={active ? t.c.onPrimary : t.c.text}>
              {o.label}
            </Text>
            {count !== undefined && (
              <View style={[styles.segCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : t.c.surfaceAlt }]}>
                <Text size={11} weight="bold" color={active ? t.c.onPrimary : t.c.muted} lineHeight={14}>
                  {count}
                </Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Selectable chips (multi or single choice). */
export function ChoiceChips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  const t = useRoleTheme();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <Pressable
            key={o}
            onPress={() => {
              triggerHaptic('selection');
              onToggle(o);
            }}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            style={[styles.chip, { borderColor: on ? t.c.primary : t.c.border, backgroundColor: on ? t.c.soft : t.c.surface }]}>
            {on && <Ionicons name="checkmark" size={14} color={t.c.primary} />}
            <Text size={13} weight="semibold" color={on ? t.c.primary : t.c.text}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Tappable list row with leading visual and trailing slot. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  icon,
  meta,
}: {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  icon?: IconName;
  meta?: ReactNode;
}) {
  const t = useRoleTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.c.surfaceAlt }]}>
      {leading ??
        (icon && (
          <View style={[styles.rowIcon, { backgroundColor: t.c.soft }]}>
            <Ionicons name={icon} size={19} color={t.c.primary} />
          </View>
        ))}
      <View style={{ flex: 1, gap: 2 }}>
        <Text size={15} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text size={13} color={t.c.muted} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
        {meta}
      </View>
      {trailing ?? (onPress && <Ionicons name="chevron-forward" size={18} color={t.c.subtle} />)}
    </Pressable>
  );
}

/** Floating action button in the role's primary colour. */
export function Fab({ icon = 'add', label, onPress, bottom = 20 }: { icon?: IconName; label?: string; onPress: () => void; bottom?: number }) {
  const t = useRoleTheme();
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('medium');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label ?? 'Create'}
      style={({ pressed }) => [
        styles.fab,
        { bottom, backgroundColor: t.c.primary, opacity: pressed ? 0.9 : 1, paddingHorizontal: label ? 18 : 0, width: label ? undefined : 56 },
      ]}>
      <Ionicons name={icon} size={24} color={t.c.onPrimary} />
      {label && (
        <Text size={15} weight="bold" color={t.c.onPrimary}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.2, paddingHorizontal: 14 },
  segRow: { gap: 8, paddingHorizontal: 16 },
  seg: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderWidth: 1 },
  segCount: { minWidth: 20, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1.2, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 18,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
});
