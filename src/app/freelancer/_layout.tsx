import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useRoleFonts } from '@/theme/fonts';
import { ROLE_THEMES } from '@/theme/roles';
import { RoleThemeProvider } from '@/theme/RoleTheme';

const t = ROLE_THEMES.freelancer;

/** Freelancer app — dark, gig-first experience for photographers, MUAs and crew. */
export default function FreelancerLayout() {
  const fontsReady = useRoleFonts('freelancer');
  if (!fontsReady) return null;

  return (
    <RoleThemeProvider role="freelancer">
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="gig/[id]" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="assignment/[id]" />
        <Stack.Screen name="portfolio" />
        <Stack.Screen name="verification" />
        <Stack.Screen name="inbox/index" />
        <Stack.Screen name="inbox/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="tools" />
        <Stack.Screen name="tool/[id]" />
      </Stack>
    </RoleThemeProvider>
  );
}
