import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, inputReset, radius } from '@/constants/theme';

import { Text } from './Text';

export interface FieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

/** Labelled text input with inline validation message. */
export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, style, multiline, ...rest }, ref) {
  return (
    <View style={{ gap: 6 }}>
      <Text size={13} weight="semibold" color={colors.textBody}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholder}
        selectionColor={colors.primary}
        multiline={multiline}
        style={[styles.input, inputReset, multiline && styles.multiline, !!error && styles.inputError, style]}
        {...rest}
      />
      {!!error && (
        <Text size={12} color={colors.danger}>
          {error}
        </Text>
      )}
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
  inputError: { borderColor: colors.danger },
});
