import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { serif as serifFaces, type FontWeight } from '@/constants/theme';
import { useRoleTheme } from '@/theme/RoleTheme';

export interface TextProps extends RNTextProps {
  weight?: FontWeight;
  size?: number;
  color?: string;
  align?: TextStyle['textAlign'];
  lineHeight?: number;
  uppercase?: boolean;
  tracking?: number;
  /** Set in Martel, the display serif. Use for a few headline lines only. */
  serif?: boolean;
}

/**
 * App-wide text primitive. Every role sets UI text in Mukta; `serif` switches
 * to Martel for display lines. Custom fonts on Android ignore `fontWeight`, so
 * weight is expressed through the family name.
 */
export function Text({
  weight = 'regular',
  size = 15,
  color,
  align,
  lineHeight,
  uppercase,
  tracking,
  serif,
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
          fontFamily: serif ? serifFaces[weight] : theme.fonts[weight],
          fontSize: size,
          color: color ?? theme.c.text,
          textAlign: align,
          lineHeight: lineHeight ?? Math.round(size * (serif ? 1.3 : 1.38)),
          textTransform: uppercase ? 'uppercase' : undefined,
          letterSpacing: tracking,
        },
        style,
      ]}
    />
  );
}
