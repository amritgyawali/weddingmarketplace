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
const LIGHT = {
  // Burgundy family
  primary: '#681C2A',
  primaryDark: '#3D1018',
  primarySoft: '#F0E3DE',
  primaryTint: '#F7EEE8',
  /** Wine / oxblood: luxury sections and dark bands. */
  wine: '#3D1018',
  /** Deeper wine: the staff console's pressed and dark states. */
  wineDeep: '#260A0F',
  /** Soft wine tint: the staff console's selected and soft fills. */
  wineSoft: '#EDE0DC',
  /** Secondary text on wine bands (8.7 : 1). */
  onWineMuted: 'rgba(255,252,248,0.72)',

  // Metallic + romantic accents
  gold: '#C8A46B',
  /** Champagne deepened enough to read as text on ivory and pearl (5.0 : 1 on pearl). */
  goldDeep: '#7F5F2C',
  goldSoft: '#F3E7D2',
  /** Champagne at low opacity: hairlines on wine and on ivory. */
  goldLine: 'rgba(200,164,107,0.45)',
  /** Champagne at very low opacity: progress tracks on wine. */
  goldTrack: 'rgba(200,164,107,0.22)',
  rose: '#C98991',
  roseSoft: '#F6E6E5',
  /** Dusty rose deepened for small marks (freelancer role mark, avatar tone). */
  roseDeep: '#8E4F58',

  // Espresso ink
  heading: '#251B18',
  text: '#3B2E29',
  textStrong: '#251B18',
  textBody: '#54463F',
  /** Secondary text: 5.6 : 1 on ivory, 5.0 : 1 on pearl. */
  textMuted: '#6F625B',
  /** Icons, disabled states and large display numbers only (3.7 : 1); never small text. */
  textSubtle: '#8F7F74',
  placeholder: '#8E7F75',

  /** Soft white: cards, and text on dark backgrounds. */
  white: '#FFFCF8',
  black: '#000000',
  /** Warm ivory: the main app background. */
  bg: '#FFF9F2',
  /** Pearl cream: sections, filters, pressed states. */
  bgSoft: '#F5ECE2',
  bgMuted: '#EDE1D3',
  bgChip: '#EDE1D3',

  /** Card and section borders (decorative). */
  border: '#E5D6C5',
  /** Control boundaries: inputs, toggles, outline buttons (3.2 : 1, WCAG 1.4.11). */
  borderStrong: '#9F8A75',
  divider: '#EFE3D5',
  hairline: '#E9DCCB',

  stepInactive: '#BFAFA2',
  badgeNew: '#7F5F2C',
  whatsapp: '#1F9D55',
  call: '#3D6B4F',
  crown: '#C8A46B',
  star: '#C8A46B',
  marigold: '#C8A46B',
  success: '#3D6B4F',
  danger: '#B42318',
  /** Amber ink: 5.0 : 1 even on its own 10% tint (status pills). */
  warning: '#8A5A10',
  info: '#3E5C7E',
  /** Soft success fill (seated tables, success banners). */
  successSoft: '#E6F0E8',
  /** Soft danger fill behind a destructive icon. */
  dangerSoft: '#FBE9E7',
  /** Dark surfaces for warning and error toasts. */
  warningDeep: '#3A2E12',
  dangerDeep: '#4A1515',
  /** Status accents that read on dark toasts and wine bands. */
  successOnDark: '#7FC49B',
  warningOnDark: '#E0B04C',
  dangerOnDark: '#F09A90',

  toolBlue: '#F5ECE2',
  toolWarm: '#F5ECE2',
  collectionBand: '#F5ECE2',
  lavenderTop: '#F5ECE2',
  lavenderBottom: '#F5ECE2',
  overlay: 'rgba(37,27,24,0.55)',
  /** Text and icons on surfaces that stay dark in both modes (wine bands, photos, dark toasts). */
  onDark: '#FFFCF8',
  /** Fills that stay dark in both modes (floating pills, photo placeholders). */
  inkFill: '#251B18',
};

/**
 * "Wine night": the dark palette. Same names as the light one, so every
 * screen that reads `colors.x` changes with the scheme. Surfaces are warm
 * espresso blacks (never grey), the burgundy accent lifts to a dusty rose
 * that reads as text and as a fill (with dark text on it), and champagne
 * gold stays the metal. Every text pair is at least 4.5 : 1 on `bg`,
 * `white` (cards) and `bgSoft`; control borders are 3 : 1.
 */
const DARK: Palette = {
  primary: '#E8A3AE',
  primaryDark: '#F2C3CA',
  primarySoft: '#3A1E24',
  primaryTint: '#2A181B',
  wine: '#3D1018',
  wineDeep: '#260A0F',
  wineSoft: '#3A1E24',
  onWineMuted: 'rgba(255,252,248,0.72)',

  gold: '#C8A46B',
  goldDeep: '#D9BC86',
  goldSoft: '#33281A',
  goldLine: 'rgba(200,164,107,0.45)',
  goldTrack: 'rgba(200,164,107,0.22)',
  rose: '#C98991',
  roseSoft: '#3A2327',
  roseDeep: '#DFA2AA',

  heading: '#F7EDE5',
  text: '#EADFD6',
  textStrong: '#F7EDE5',
  textBody: '#D8CAC0',
  textMuted: '#B6A69B',
  textSubtle: '#8F7F74',
  placeholder: '#8F8076',

  white: '#1C1513',
  black: '#000000',
  bg: '#130D0C',
  bgSoft: '#241B19',
  bgMuted: '#2E2421',
  bgChip: '#2E2421',

  border: '#3A2E2A',
  borderStrong: '#8A766A',
  divider: '#2C2220',
  hairline: '#30251F',

  stepInactive: '#4F423C',
  badgeNew: '#D9BC86',
  whatsapp: '#1F9D55',
  call: '#7FC49B',
  crown: '#C8A46B',
  star: '#C8A46B',
  marigold: '#C8A46B',
  success: '#86C9A0',
  danger: '#F2A097',
  warning: '#E4B65A',
  info: '#9DBDE0',
  successSoft: '#1C2E23',
  dangerSoft: '#3D1C19',
  warningDeep: '#3A2E12',
  dangerDeep: '#4A1515',
  successOnDark: '#7FC49B',
  warningOnDark: '#E0B04C',
  dangerOnDark: '#F09A90',

  toolBlue: '#241B19',
  toolWarm: '#241B19',
  collectionBand: '#241B19',
  lavenderTop: '#241B19',
  lavenderBottom: '#241B19',
  overlay: 'rgba(0,0,0,0.66)',
  onDark: '#FFFCF8',
  inkFill: '#2B211E',
};

export type Palette = { [K in keyof typeof LIGHT]: string };
export type ColorScheme = 'light' | 'dark';

/** The two palettes, for screens that preview both (Settings → Appearance). */
export const PALETTES: Record<ColorScheme, Palette> = { light: LIGHT, dark: DARK };

/**
 * The live palette. Screens read `colors.x` during render (or inside a
 * `themed()` style sheet); `applyColorScheme` swaps the values in place and
 * the root layout remounts the tree, so nothing keeps a stale colour.
 */
export const colors: Readonly<Palette> = { ...LIGHT };

let scheme: ColorScheme = 'light';
let schemeVersion = 0;
const schemeListeners = new Set<(scheme: ColorScheme) => void>();

/** The colour scheme on screen now. */
export const currentColorScheme = (): ColorScheme => scheme;

/** Runs `fn` after every scheme change (role themes and gradients rebuild themselves). Returns an unsubscribe. */
export function onColorScheme(fn: (scheme: ColorScheme) => void): () => void {
  schemeListeners.add(fn);
  return () => schemeListeners.delete(fn);
}

/** Status bar text that reads on the current background: dark text in light mode, light text in dark mode. */
export const statusBarStyle = (): 'light' | 'dark' => (scheme === 'dark' ? 'light' : 'dark');

/** Switches every token to the light or dark palette. Idempotent; call it before the tree renders with the new scheme. */
export function applyColorScheme(next: ColorScheme) {
  if (next === scheme) return;
  scheme = next;
  schemeVersion += 1;
  Object.assign(colors as Palette, PALETTES[next]);
  for (const fn of schemeListeners) fn(next);
}

/**
 * A module-level style sheet that follows the colour scheme. Wrap
 * `StyleSheet.create({...})` in it whenever the styles read a colour token:
 * `const styles = themed(() => StyleSheet.create({ ... }))`. The factory runs
 * again on first use after the scheme changes.
 */
export function themed<T extends object>(factory: () => T): T {
  let cache: T | null = null;
  let version = -1;
  const read = (): T => {
    if (version !== schemeVersion || !cache) {
      cache = factory();
      version = schemeVersion;
    }
    return cache;
  };
  return new Proxy({} as T, {
    get: (_, key) => (read() as Record<PropertyKey, unknown>)[key],
    has: (_, key) => key in read(),
    ownKeys: () => Reflect.ownKeys(read()),
    getOwnPropertyDescriptor: (_, key) => {
      const d = Reflect.getOwnPropertyDescriptor(read(), key);
      return d ? { ...d, configurable: true } : undefined;
    },
  });
}

/** Network marks in the social hub. Small icons and hairlines only, never fills. */
export const socialColors = {
  facebook: '#1877F2',
  instagram: '#C13584',
  whatsapp: '#128C7E',
  tiktok: '#161823',
} as const;

/**
 * Only photo scrims remain; flat colour everywhere else. The remaining keys
 * are kept so older call sites still type-check, and all resolve to flat or
 * near-flat fills.
 */
const buildGradients = () => ({
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
  /** Wine-tinted scrim under captions on photo cards (never grey). */
  photoCaption: ['rgba(37,14,18,0)', 'rgba(37,14,18,0.35)', 'rgba(37,14,18,0.86)'] as const,
});

export const gradients = buildGradients();
onColorScheme(() => Object.assign(gradients, buildGradients()));

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

const rgba = (hex: string, alpha: number) => {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** Drop shadow for something that floats: elevation on Android, `boxShadow` on the web (shadow* props are deprecated there), shadow* on iOS. */
export const shadow = (
  elevation: number,
  opacity: number,
  radiusPx: number,
  offsetY: number,
  color = '#251B18',
): ViewStyle =>
  Platform.select<ViewStyle>({
    android: { elevation, shadowColor: color },
    web: { boxShadow: `0px ${offsetY}px ${radiusPx}px ${rgba(color, opacity)}` },
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

/** Figures that line up in columns (money, counts, countdowns). */
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

/** Icon sizes: snap every Ionicon to one of these. */
export const iconSize = { xs: 14, sm: 16, md: 20, lg: 24, xl: 28 } as const;

/**
 * Motion timing (ms). One or two things move per screen, always with the
 * ease-out curve in `hooks/useMotion`, and nothing moves when the device asks
 * for reduced motion.
 */
export const motion = { fast: 150, base: 240, slow: 360, stagger: 45 } as const;

export const hitSlop = { top: 10, bottom: 10, left: 10, right: 10 };

/**
 * The font typed text uses inside inputs on phones: the system font at the
 * given weight. Mukta's line box is 1.66 em tall (room for Devanagari marks),
 * and iOS and Android size the text caret from it, so the cursor looked half
 * again taller than the text. Web keeps Mukta; the browser caret follows the
 * text. Put it after any `fontFamily` in an input's style array.
 */
export const inputFont = (weight: '400' | '500' | '600' | '700' = '400'): TextStyle =>
  Platform.OS === 'web' ? {} : { fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif', fontWeight: weight };

/**
 * Base style for every text input: removes the browser focus ring on web and
 * sets the normal-height caret font on phones (see `inputFont`).
 */
export const inputReset: TextStyle = Platform.OS === 'web' ? { outlineStyle: 'none' as never } : inputFont();
