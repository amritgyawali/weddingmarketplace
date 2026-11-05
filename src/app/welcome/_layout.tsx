import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';
import { usesDirectRoleEntry } from '@/constants/env';
import { useRoleFonts } from '@/theme/fonts';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

export default function WelcomeLayout() {
  useRoleFonts('customer');

  return (
    <Stack screenLayout={keyboardScreenLayout} screenOptions={{ headerShown: false, animation: Platform.OS === 'android' ? 'slide_from_right' : 'default' }}>
      <Stack.Screen name="index" options={{ contentStyle: { backgroundColor: colors.black } }} />
      <Stack.Protected guard={!usesDirectRoleEntry()}>
        <Stack.Screen name="login" />
        <Stack.Screen name="setup" />
      </Stack.Protected>
    </Stack>
  );
}
