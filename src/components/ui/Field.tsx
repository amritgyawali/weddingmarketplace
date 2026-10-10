import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, inputReset, radius } from '@/constants/theme';
import { useT } from '@/i18n';

import { FieldNote } from './FieldNote';
import { Text } from './Text';

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  /** With `maxLength`, shows "Minimum n, maximum m characters" and a live count. */
  minLength?: number;
}

/** Labelled text input with a focus border, an inline validation message and, for descriptions, the allowed length. */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, hint, required, style, multiline, placeholder, onFocus, onBlur, minLength, ...rest }, ref) {
  const tr = useT();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text size={13} weight="semibold" color={colors.textBody}>
        {label}
        {required ? <Text size={13} color={colors.danger}> *</Text> : null}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.primary}
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
        style={[styles.input, inputReset, multiline && styles.multiline, focused && styles.inputFocused, !!error && styles.inputError, style]}
        {...rest}
      />
      {multiline && (rest.maxLength || minLength) ? (
        <FieldNote error={error} hint={hint} length={(rest.value ?? '').length} minLength={minLength} maxLength={rest.maxLength} tone={{ danger: colors.danger, muted: colors.textMuted, warning: colors.warning }} />
      ) : error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={14} color={colors.danger} />
          <Text size={12} color={colors.danger} style={{ flexShrink: 1 }}>
            {error}
          </Text>
        </View>
      ) : hint ? (
        <Text size={12} color={colors.textMuted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textStrong,
  },
  multiline: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.primary, borderWidth: 2, paddingHorizontal: 13 },
  inputError: { borderColor: colors.danger },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
