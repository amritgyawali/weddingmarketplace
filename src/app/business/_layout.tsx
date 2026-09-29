import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useRoleFonts } from '@/theme/fonts';
import { ROLE_THEMES } from '@/theme/roles';
import { RoleThemeProvider } from '@/theme/RoleTheme';

const t = ROLE_THEMES.vendor;

/** Vendor Pro — the business app for venues and wedding vendors. */
export default function BusinessLayout() {
  const fontsReady = useRoleFonts('vendor');
  if (!fontsReady) return null;

  return (
    <RoleThemeProvider role="vendor">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lead/[id]" />
        <Stack.Screen name="quote/[id]" />
        <Stack.Screen name="project/[id]" />
        <Stack.Screen name="gigs" />
        <Stack.Screen name="gig/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="gig/[id]" />
      </Stack>
    </RoleThemeProvider>
  );
}
