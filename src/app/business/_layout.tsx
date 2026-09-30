import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useRoleFonts } from '@/theme/fonts';
import { ROLE_THEMES } from '@/theme/roles';
import { RoleThemeProvider } from '@/theme/RoleTheme';

const t = ROLE_THEMES.vendor;

/** Vivah for Business — venues, studios and wedding vendors. */
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
        <Stack.Screen name="quotes" />
        <Stack.Screen name="booking/[id]" />
        <Stack.Screen name="gigs" />
        <Stack.Screen name="gig/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="gig/[id]" />
        <Stack.Screen name="packages" />
        <Stack.Screen name="portfolio" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="promotions" />
        <Stack.Screen name="reviews" />
        <Stack.Screen name="team" />
        <Stack.Screen name="customers" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="inbox/index" />
        <Stack.Screen name="inbox/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="tools" />
        <Stack.Screen name="tool/[id]" />
        <Stack.Screen name="services" />
      </Stack>
    </RoleThemeProvider>
  );
}
