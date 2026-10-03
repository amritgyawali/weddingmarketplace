import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import { useRoleFonts } from '@/theme/fonts';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

export default function WelcomeLayout() {
  // Warm up every app's typeface while the carousel plays; the role picker and
  // login screens preview them. Screens that need them wait on the same hook.
  useRoleFonts('all');

  return (
    <Stack screenLayout={keyboardScreenLayout} screenOptions={{ headerShown: false, animation: Platform.OS === 'android' ? 'slide_from_right' : 'default' }}>
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.black } }} />
      <Stack.Screen name="role" />
      <Stack.Screen name="login" />
      <Stack.Screen name="setup" />
    </Stack>
  );
}
