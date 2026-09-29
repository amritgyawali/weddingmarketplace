import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import type { FontWeight } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

export interface TextProps extends RNTextProps {
  weight?: FontWeight;
  size?: number;
  color?: string;
  align?: TextStyle['textAlign'];
  lineHeight?: number;
  uppercase?: boolean;
  tracking?: number;
}

/**
 * App-wide text primitive. Font family and default colour come from the active
 * role theme (Manrope for couples, Jakarta for vendors, Space Grotesk for
 * freelancers, Inter for the platform). Custom fonts on Android ignore
 * `fontWeight`, so weight is expressed through the family name.
 */
export function Text({
  weight = 'regular',
  size = 15,
  color,
  align,
  lineHeight,
  uppercase,
  tracking,
  style,
  ...rest
}: TextProps) {
  const theme = useRoleTheme();
  return (
    <RNText
      allowFontScaling
      maxFontSizeMultiplier={1.3}
      {...rest}
      style={[
        {
          fontFamily: theme.fonts[weight],
          fontSize: size,
          color: color ?? theme.c.text,
          textAlign: align,
          lineHeight: lineHeight ?? Math.round(size * 1.35),
          textTransform: uppercase ? 'uppercase' : undefined,
          letterSpacing: tracking,
        },
        style,
      ]}
    />
  );
}
