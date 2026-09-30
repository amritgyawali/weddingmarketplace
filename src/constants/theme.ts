import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Couple-app design tokens. Every hard-coded colour lives here.
 *
 * The palette is taken from a Nepali wedding rather than a UI kit: sindoor
 * crimson for actions, marigold (sayapatri) for ratings and highlights, pote
 * green for "done". Neutrals are warm greys so photos of red saris and brass
 * lamps sit on them without clashing. Colour is used sparingly: most of the
 * screen is white paper, dark ink and hairlines.
 */
export const colors = {
  primary: '#A3172F',
  primaryDark: '#7E0F22',
  primarySoft: '#F7E8EA',
  primaryTint: '#FBF4F5',

  heading: '#1F1C19',
  text: '#34302C',
  textStrong: '#1F1C19',
  textBody: '#4A4540',
  textMuted: '#6F6962',
  textSubtle: '#9A948C',
  placeholder: '#A29C94',

  white: '#FFFFFF',
  black: '#000000',
  bg: '#FFFFFF',
  bgSoft: '#F5F4F1',
  bgMuted: '#EFEDE9',
  bgChip: '#EFEDE9',

  border: '#DEDAD4',
  divider: '#ECE9E4',
  hairline: '#E4E0DA',

  stepInactive: '#B5AFA7',
  badgeNew: '#2E6B4F',
  whatsapp: '#1F9D55',
  call: '#2E6B4F',
  crown: '#C98410',
  star: '#C98410',
  marigold: '#D99A1E',
  success: '#2E6B4F',
  danger: '#B42318',
  warning: '#A86A0C',

  toolBlue: '#F2F3F1',
  toolWarm: '#F7F2EC',
  collectionBand: '#F5F4F1',
  lavenderTop: '#F5F4F1',
  lavenderBottom: '#F5F4F1',
  overlay: 'rgba(20,16,12,0.5)',
} as const;

/**
 * Only photo scrims remain; flat colour everywhere else. The remaining keys
 * are kept so older call sites still type-check, and all resolve to flat or
 * near-flat fills.
 */
export const gradients = {
  genieRing: [colors.primary, colors.primary] as const,
  checklist: [colors.primary, colors.primary] as const,
  filterBar: [colors.heading, colors.heading] as const,
  assistantBg: [colors.bgSoft, colors.bgSoft] as const,
  heroFade: ['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.45)', 'rgba(0,0,0,0.85)'] as const,
  collectionLuxury: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const,
  collectionBudget: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const,
  collectionDestination: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const,
  collectionHeritage: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const,
  collectionGarden: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)'] as const,
};

/**
 * Mukta (Ek Type) for everything you read and tap: it was drawn for
 * Devanagari and Latin together, so Nepali names and "शुभ विवाह" set in the
 * same voice as the English UI. Martel, its serif sibling from the same
 * foundry, is kept for a handful of display lines (couple names, screen
 * titles on the couple app).
 */
export const fonts = {
  regular: 'Mukta_400Regular',
  medium: 'Mukta_500Medium',
  semibold: 'Mukta_600SemiBold',
  bold: 'Mukta_700Bold',
  extrabold: 'Mukta_800ExtraBold',
} as const;

export const serif = {
  regular: 'Martel_400Regular',
  medium: 'Martel_600SemiBold',
  semibold: 'Martel_600SemiBold',
  bold: 'Martel_700Bold',
  extrabold: 'Martel_800ExtraBold',
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
  xs: 3,
  sm: 6,
  md: 8,
  lg: 10,
  xl: 12,
  pill: 999,
} as const;

/** Page gutter. */
export const GUTTER = 16;

const shadow = (
  elevation: number,
  opacity: number,
  radiusPx: number,
  offsetY: number,
  color = '#1F1C19',
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

/** Shadows are reserved for things that genuinely float (sheets, toasts). */
export const shadows = {
  pill: {} as ViewStyle,
  card: {} as ViewStyle,
  raised: shadow(6, 0.12, 14, 4),
  fab: shadow(4, 0.16, 8, 3),
  pinkGlow: {} as ViewStyle,
  whatsappGlow: {} as ViewStyle,
  tabBar: {} as ViewStyle,
};

export const type = {
  display: { fontFamily: serif.bold, fontSize: 30, lineHeight: 40 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  section: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24 },
  heading: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodySmall: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  micro: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14 },
} satisfies Record<string, TextStyle>;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

/** Removes the browser focus ring from text inputs on web (native is unaffected). */
export const inputReset: TextStyle = Platform.OS === 'web' ? { outlineStyle: 'none' as never } : {};
