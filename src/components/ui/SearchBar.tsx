import { Ionicons } from '@expo/vector-icons';
import { forwardRef } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, inputReset, radius } from '@/constants/theme';
import { useT } from '@/i18n';

import { Text } from './Text';

export interface SearchBarProps extends Omit<TextInputProps, 'style'> {
  /** When set, the bar renders as a button (e.g. to open the search screen). */
  onPressReadOnly?: () => void;
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  height?: number;
}

/** Search field used on the Venues, Ideas and City screens. */
export const SearchBar = forwardRef<TextInput, SearchBarProps>(function SearchBar(
  { onPressReadOnly, trailing, style, height = 42, placeholder, value, onChangeText, ...rest },
  ref,
) {
  const tr = useT();
  const content = (
    <>
      <Ionicons name="search" size={17} color={colors.textMuted} />
      {onPressReadOnly ? (
        <Text size={15} color={colors.placeholder} style={styles.flex} numberOfLines={1}>
          {placeholder}
        </Text>
      ) : (
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder ? tr(placeholder) : undefined}
          placeholderTextColor={colors.placeholder}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.flex, styles.input, inputReset]}
          {...rest}
        />
      )}
      {!onPressReadOnly && !!value && (
        <Pressable
          onPress={() => onChangeText?.('')}
          hitSlop={10}
          accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={18} color={colors.textSubtle} />
        </Pressable>
      )}
      {trailing}
    </>
  );

  if (onPressReadOnly) {
    return (
      <Pressable
        onPress={onPressReadOnly}
        accessibilityRole="search"
        style={[styles.container, { height }, style]}>
        {content}
      </Pressable>
    );
  }
  return <View style={[styles.container, { height }, style]}>{content}</View>;
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    gap: 8,
  },
  flex: { flex: 1 },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textStrong,
    paddingVertical: 0,
    height: '100%',
  },
});
