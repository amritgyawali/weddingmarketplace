import { useColorScheme } from 'react-native';

import type { ColorScheme } from '@/constants/theme';
import { usePrefs } from '@/i18n';

/** The scheme this device should show: the person's choice in Settings, or the phone's own when they chose "Same as phone". */
export function useResolvedScheme(): ColorScheme {
  const appearance = usePrefs((s) => s.appearance) ?? 'system';
  const system = useColorScheme();
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}
