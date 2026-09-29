import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens extracted from the Stitch screen sequence
 * (stitch_mobile_ui_sequence_clone/*). Keep every hard-coded colour here so
 * screens stay pixel-consistent with the reference UI.
 */
export const colors = {
  primary: '#E72E77',
  primaryDark: '#C91D62',
  primarySoft: '#FDE8F0',
  primaryTint: '#FFF5F9',

  heading: '#3D3D3F',
  text: '#444446',
  textStrong: '#222222',
  textBody: '#555557',
  textMuted: '#8A8C90',
  textSubtle: '#A3A6AB',
  placeholder: '#9C9FA5',

  white: '#FFFFFF',
  black: '#000000',
  bg: '#FFFFFF',
  bgSoft: '#FAFAFA',
  bgMuted: '#F2F2F4',
  bgChip: '#EFEFF1',

  border: '#E8E8EA',
  divider: '#F0F0F2',
  hairline: '#E4E4E7',

  stepInactive: '#9E9E9E',
  badgeNew: '#008767',
  whatsapp: '#00D65B',
  call: '#1FA64F',
  crown: '#F7941D',
  star: '#E72E77',
  success: '#1FA64F',
  danger: '#E5484D',
  warning: '#F5A623',

  toolBlue: '#F3F6FB',
  toolWarm: '#FBF7F4',
  collectionBand: '#EAF2FA',
  lavenderTop: '#D3CFF3',
  lavenderBottom: '#F3E7F3',
  overlay: 'rgba(0,0,0,0.45)',
} as const;

/** Gradient stops reused across screens. */
export const gradients = {
  genieRing: ['#2563EB', '#8B5CF6', '#EC4899'] as const,
  checklist: ['#E8317A', '#EF5A76', '#FA8C5E'] as const,
  filterBar: ['#E62872', '#EB3B7F', '#E62872'] as const,
  assistantBg: ['#FFFFFF', '#D6D1F4', '#E4DDF7', '#F3E8F4'] as const,
  heroFade: ['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.92)'] as const,
  collectionLuxury: ['#D09A6B', '#9A5B34', '#3A1F10'] as const,
  collectionBudget: ['#EF7A1A', '#B8300A', '#4A0B02'] as const,
  collectionDestination: ['#E0B64A', '#8C6A14', '#2C2205'] as const,
  collectionHeritage: ['#B55C8F', '#7A2A5A', '#2E0C22'] as const,
  collectionGarden: ['#7FB069', '#3E7A3A', '#10280F'] as const,
};

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export type FontWeight = keyof typeof fonts;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/** Page gutter used by the reference screens (≈20pt). */
export const GUTTER = 20;

const shadow = (
  elevation: number,
  opacity: number,
  radiusPx: number,
  offsetY: number,
  color = '#000',
): ViewStyle =>
  Platform.select<ViewStyle>({
    android: { elevation, shadowColor: color },
    default: {
      shadowColor: color,
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: offsetY },
    },
  })!;

export const shadows = {
  pill: shadow(3, 0.09, 10, 3),
  card: shadow(4, 0.08, 14, 4),
  raised: shadow(10, 0.16, 20, 8),
  fab: shadow(8, 0.25, 12, 6),
  pinkGlow: shadow(6, 0.3, 12, 6, colors.primary),
  whatsappGlow: shadow(8, 0.4, 12, 4, colors.whatsapp),
  tabBar: shadow(12, 0.05, 8, -3),
};

export const type = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  section: { fontFamily: fonts.semibold, fontSize: 19, lineHeight: 25, letterSpacing: -0.2 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 23 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.bold, fontSize: 10, lineHeight: 13, letterSpacing: 0.4 },
} satisfies Record<string, TextStyle>;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

/** Removes the browser focus ring from text inputs on web (native is unaffected). */
export const inputReset: TextStyle = Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {};
