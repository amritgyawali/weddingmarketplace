import {
  Martel_400Regular,
  Martel_600SemiBold,
  Martel_700Bold,
  Martel_800ExtraBold,
} from '@expo-google-fonts/martel';
import {
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
  Mukta_800ExtraBold,
} from '@expo-google-fonts/mukta';

import type { UserRole } from '@/types/platform';

/** Every face the app uses. Loaded once by the root layout. */
export const APP_FONTS = {
  Mukta_400Regular,
  Mukta_500Medium,
  Mukta_600SemiBold,
  Mukta_700Bold,
  Mukta_800ExtraBold,
  Martel_400Regular,
  Martel_600SemiBold,
  Martel_700Bold,
  Martel_800ExtraBold,
};

/**
 * All roles share one type family now, loaded before the first render, so
 * there is nothing left to load per role. Kept so existing layouts that gate
 * on it keep working.
 */
export function useRoleFonts(_role: UserRole | 'all') {
  return true;
}
