import { Ionicons } from '@expo/vector-icons';
import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, inputReset, radius } from '@/constants/theme';
import { useT } from '@/i18n';

import { Text } from './Text';

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
}

/** Labelled text input with a focus border and an inline validation message. */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, hint, required, style, multiline, placeholder, onFocus, onBlur, ...rest }, ref) {
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
      {error ? (
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
    borderColor: colors.border,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.textStrong,
  },
  multiline: { minHeight: 110, paddingTop: 12, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.heading, borderWidth: 1.5 },
  inputError: { borderColor: colors.danger },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
