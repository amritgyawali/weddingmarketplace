import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Design tokens: "Royal Nepali Luxury". Every hard-coded colour lives here.
 *
 * Deep burgundy and wine are the rich dark anchors (the colour of a bridal
 * sari and a temple door), champagne gold is a restrained metallic accent for
 * borders, badges and ratings, and the neutrals are warm ivory and pearl cream
 * so photos of red saris and brass lamps sit on them without clashing.
 *
 * Rough distribution on any screen: ~65% ivory/cream, ~20% burgundy/wine,
 * ~10% espresso text, ~5% champagne and dusty-rose accents. Gold never fills
 * large areas, and is never used for body text (use `goldDeep` for gold text).
 */
export const colors = {
  // Burgundy family
  primary: '#681C2A',
  primaryDark: '#3D1018',
  primarySoft: '#F0E3DE',
  primaryTint: '#F7EEE8',
  /** Wine / oxblood: luxury sections and dark bands. */
  wine: '#3D1018',

  // Metallic + romantic accents
  gold: '#C8A46B',
  /** Champagne deepened enough to read as text on ivory. */
  goldDeep: '#8C6A33',
  goldSoft: '#F3E7D2',
  /** Champagne at low opacity: hairlines on wine and on ivory. */
  goldLine: 'rgba(200,164,107,0.45)',
  rose: '#C98991',
  roseSoft: '#F6E6E5',

  // Espresso ink
  heading: '#251B18',
  text: '#3B2E29',
  textStrong: '#251B18',
  textBody: '#54463F',
  textMuted: '#796B64',
  textSubtle: '#A39388',
  placeholder: '#A99A90',

  /** Soft white: cards, and text on dark backgrounds. */
  white: '#FFFCF8',
  black: '#000000',
  /** Warm ivory: the main app background. */
  bg: '#FFF9F2',
  /** Pearl cream: sections, filters, pressed states. */
  bgSoft: '#F5ECE2',
  bgMuted: '#EDE1D3',
  bgChip: '#EDE1D3',

  border: '#E5D6C5',
  divider: '#EFE3D5',
  hairline: '#E9DCCB',

  stepInactive: '#BFAFA2',
  badgeNew: '#8C6A33',
  whatsapp: '#1F9D55',
  call: '#3D6B4F',
  crown: '#C8A46B',
  star: '#C8A46B',
  marigold: '#C8A46B',
  success: '#3D6B4F',
  danger: '#B42318',
  warning: '#9A6412',

  toolBlue: '#F5ECE2',
  toolWarm: '#F5ECE2',
  collectionBand: '#F5ECE2',
  lavenderTop: '#F5ECE2',
  lavenderBottom: '#F5ECE2',
  overlay: 'rgba(37,27,24,0.55)',
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
  color = '#251B18',
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
