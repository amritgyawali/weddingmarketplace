import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { inputReset, shadow } from '@/constants/theme';
import { useT } from '@/i18n';
import { useRoleTheme } from '@/theme/RoleTheme';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

import type { IconName } from './primitives';

/**
 * Labelled input for the role apps. The border darkens while typing, turns
 * red with an error, and the error (or a hint) shows under the field.
 * Placeholders are translated with the rest of the app.
 */
export const KField = forwardRef<TextInput, TextInputProps & { label?: string; error?: string | null; prefix?: string; hint?: string; required?: boolean }>(function KField(
  { label, error, prefix, hint, required, style, multiline, placeholder, onFocus, onBlur, ...rest },
  ref,
) {
  const t = useRoleTheme();
  const tr = useT();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <Text size={13} weight="medium" color={t.c.text}>
          {label}
          {required ? <Text size={13} color={t.c.danger}> *</Text> : null}
        </Text>
      )}
      <View
        style={[
          styles.field,
          { backgroundColor: t.dark ? t.c.surfaceAlt : t.c.surface, borderColor: error ? t.c.danger : focused ? t.c.primary : t.c.borderStrong, borderRadius: t.role === 'platform' ? 6 : 8 },
          focused && !error && { borderWidth: 2, paddingHorizontal: 11 },
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
          placeholder={placeholder ? tr(placeholder) : undefined}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            { flex: 1, fontFamily: t.fonts.regular, fontSize: 15, color: t.c.textStrong, paddingVertical: multiline ? 12 : 0, minHeight: 46, textAlignVertical: multiline ? 'top' : 'center' },
            inputReset,
            style,
          ]}
          {...rest}
        />
        {!!error && <Ionicons name="alert-circle" size={18} color={t.c.danger} style={multiline ? { marginTop: 12 } : undefined} />}
      </View>
      {error ? (
        <Text size={12} color={t.c.danger} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text size={12} color={t.c.muted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

/** Underlined tab strip; scrolls horizontally when it overflows. */
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={[styles.segRow, { borderBottomColor: t.c.border }]}>
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
            style={[styles.seg, { borderBottomColor: active ? t.c.primary : 'transparent' }]}>
            <Text size={14} weight={active ? 'semibold' : 'regular'} color={active ? t.c.textStrong : t.c.muted}>
              {o.label}
            </Text>
            {count !== undefined && (
              <View style={[styles.segCount, { backgroundColor: active ? t.c.soft : t.c.surfaceAlt }]}>
                <Text size={12} weight="semibold" color={active ? t.c.primary : t.c.muted} lineHeight={16} numeric maxFontSizeMultiplier={1.2}>
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
            style={[styles.chip, { borderColor: on ? t.c.primary : t.c.border, backgroundColor: on ? t.c.primary : t.c.surface }]}>
            {on && <Ionicons name="checkmark" size={14} color={t.c.onPrimary} />}
            <Text size={14} weight={on ? 'semibold' : 'regular'} color={on ? t.c.onPrimary : t.c.text}>
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * One filter or sort chip, the same in every role app: pearl at rest,
 * burgundy with a check when selected (so the state never rests on colour
 * alone). Use for ad-hoc chip rows instead of styling a Pressable by hand.
 */
export function FilterChip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  const t = useRoleTheme();
  const fg = selected ? t.c.onPrimary : t.c.text;
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [
        styles.chip,
        { borderColor: selected ? t.c.primary : t.c.border, backgroundColor: selected ? t.c.primary : t.c.surface },
        pressed && { opacity: 0.75 },
      ]}>
      {selected ? <Ionicons name="checkmark" size={14} color={fg} /> : icon ? <Ionicons name={icon} size={14} color={t.c.muted} /> : null}
      <Text size={14} weight={selected ? 'semibold' : 'medium'} color={fg} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
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
          <View style={[styles.rowIcon, { backgroundColor: t.c.surfaceAlt }]}>
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
        { bottom, backgroundColor: t.c.primary, opacity: pressed ? 0.85 : 1, paddingHorizontal: label ? 18 : 0, width: label ? undefined : 54, borderRadius: label ? 10 : 27 },
      ]}>
      <Ionicons name={icon} size={22} color={t.c.onPrimary} />
      {label && (
        <Text size={15} weight="semibold" color={t.c.onPrimary}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, paddingHorizontal: 12 },
  segRow: { gap: 20, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, flexGrow: 1 },
  seg: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 44, borderBottomWidth: 2, marginBottom: -StyleSheet.hairlineWidth },
  segCount: { minWidth: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 6, paddingHorizontal: 12, minHeight: 36 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  rowIcon: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    ...shadow(4, 0.18, 8, 3),
  },
});
