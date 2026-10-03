import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { useRoleFonts } from '@/theme/fonts';
import { ROLE_THEMES } from '@/theme/roles';
import { RoleThemeProvider } from '@/theme/RoleTheme';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

const t = ROLE_THEMES.platform;

/** Vivah operations console — coordinators, matching, quotes, crew, finance and trust. */
export default function PlatformLayout() {
  const fontsReady = useRoleFonts('platform');
  if (!fontsReady) return null;

  return (
    <RoleThemeProvider role="platform">
      <StatusBar style="light" />
      <Stack screenLayout={keyboardScreenLayout} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.c.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="project/[id]" />
        <Stack.Screen name="quote/[id]" />
        <Stack.Screen name="quotes" />
        <Stack.Screen name="gigs" />
        <Stack.Screen name="gig/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="gig/[id]" />
        <Stack.Screen name="approvals" />
        <Stack.Screen name="finance" />
        <Stack.Screen name="users" />
        <Stack.Screen name="providers" />
        <Stack.Screen name="provider/[id]" />
        <Stack.Screen name="freelancers" />
        <Stack.Screen name="analytics" />
        <Stack.Screen name="marketplace" />
        <Stack.Screen name="audit" />
        <Stack.Screen name="calendar" />
        <Stack.Screen name="inbox/index" />
        <Stack.Screen name="inbox/[id]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="tools" />
        <Stack.Screen name="tool/[id]" />
        <Stack.Screen name="occasions" />
        <Stack.Screen name="occasion/[id]" />
        <Stack.Screen name="admin/index" />
        <Stack.Screen name="admin/users" />
        <Stack.Screen name="admin/user/[id]" />
        <Stack.Screen name="admin/data" />
        <Stack.Screen name="admin/collection/[name]" />
        <Stack.Screen name="admin/record/[name]/[id]" />
        <Stack.Screen name="admin/features" />
        <Stack.Screen name="admin/texts" />
        <Stack.Screen name="admin/announcements" />
        <Stack.Screen name="admin/bugs" />
        <Stack.Screen name="admin/bug/[id]" />
      </Stack>
    </RoleThemeProvider>
  );
}
