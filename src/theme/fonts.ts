import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';

import type { UserRole } from '@/types/platform';

const ROLE_FONTS = {
  customer: {},
  vendor: {
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  },
  freelancer: {
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
  },
  platform: {
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  },
} satisfies Record<UserRole, Record<string, number>>;

/**
 * Each role app has its own typeface; it's loaded lazily the first time that
 * app opens so couples never download the business fonts. Resolves true on
 * error too, falling back to the system font rather than blocking the UI.
 */
export function useRoleFonts(role: UserRole | 'all') {
  const map = role === 'all' ? { ...ROLE_FONTS.vendor, ...ROLE_FONTS.freelancer, ...ROLE_FONTS.platform } : ROLE_FONTS[role];
  const [loaded, error] = useFonts(map);
  return loaded || !!error;
}
