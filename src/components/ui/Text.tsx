import { Children, type ReactNode } from 'react';
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';

import { serif as serifFaces, type FontWeight } from '@/constants/theme';
import { translate, useI18n, type Lang, type TextOverrides } from '@/i18n';
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
  /** Render the children exactly as given (names, codes, user-written text). */
  raw?: boolean;
}

/**
 * Translates plain-text children. A run of strings and numbers is joined
 * first, so "{done} of {total} tasks done" is looked up as one sentence and
 * word order can change; nested elements are left as they are.
 */
function translateChildren(children: ReactNode, lang: Lang, overrides: TextOverrides): ReactNode {
  if (typeof children === 'string') return translate(children, lang, overrides);
  if (!Array.isArray(children)) return children;
  const flat = Children.toArray(children);
  if (flat.every((c) => typeof c === 'string' || typeof c === 'number')) return translate(flat.join(''), lang, overrides);
  return flat.map((c) => (typeof c === 'string' ? translate(c, lang, overrides) : c));
}

/**
 * App-wide text primitive. Every role sets UI text in Mukta; `serif` switches
 * to Martel for display lines. Custom fonts on Android ignore `fontWeight`, so
 * weight is expressed through the family name. Text is shown in the user's
 * language (English or Nepali) through the translation runtime.
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
  raw,
  style,
  children,
  ...rest
}: TextProps) {
  const theme = useRoleTheme();
  const { active, lang, overrides } = useI18n();
  const nepali = lang === 'ne';
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
          // Devanagari needs a little more room above and below the line.
          lineHeight: lineHeight ?? Math.round(size * (serif ? 1.3 : nepali ? 1.48 : 1.38)),
          textTransform: uppercase ? 'uppercase' : undefined,
          letterSpacing: tracking,
        },
        style,
      ]}>
      {raw || !active ? children : translateChildren(children, lang, overrides)}
    </RNText>
  );
}
