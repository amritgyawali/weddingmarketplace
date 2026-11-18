import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { EDITION } from '@/constants/edition';
import { statusBarStyle } from '@/constants/theme';
import { useRoleFonts } from '@/theme/fonts';
import { ROLE_THEMES } from '@/theme/roles';
import { RoleThemeProvider } from '@/theme/RoleTheme';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

const SUPER_ADMIN_SCREENS = [
  'admin/index',
  'admin/users',
  'admin/user/[id]',
  'admin/data',
  'admin/collection/[name]',
  'admin/record/[name]/[id]',
  'admin/features',
  'admin/texts',
  'admin/content/index',
  'admin/content/[kind]/[id]',
  'admin/announcements',
  'admin/bugs',
  'admin/bug/[id]',
];

/** Vivah operations console — coordinators, matching, quotes, crew, finance and trust. */
export default function PlatformLayout() {
  const fontsReady = useRoleFonts('platform');
  if (!fontsReady) return null;
  const t = ROLE_THEMES.platform;

  return (
    <RoleThemeProvider role="platform">
      <StatusBar style={statusBarStyle()} />
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
        {/* The Staff app is built without the super admin console (metro.config.js). */}
        {EDITION !== 'staff' && SUPER_ADMIN_SCREENS.map((name) => <Stack.Screen key={name} name={name} />)}
        <Stack.Screen name="edit-profile" />
        <Stack.Screen name="support/index" />
        <Stack.Screen name="support/[id]" />
      </Stack>
    </RoleThemeProvider>
  );
}
