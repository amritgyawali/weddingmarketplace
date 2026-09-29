import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { useRoleFonts } from '@/theme/fonts';

export default function WelcomeLayout() {
  // Warm up every app's typeface while the carousel plays; the role picker and
  // login screens preview them. Screens that need them wait on the same hook.
  useRoleFonts('all');

  return (
    <Stack screenOptions={{ headerShown: false, animation: Platform.OS === 'android' ? 'slide_from_right' : 'default' }}>
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: '#000' } }} />
      <Stack.Screen name="role" />
      <Stack.Screen name="login" />
      <Stack.Screen name="setup" />
    </Stack>
  );
}
