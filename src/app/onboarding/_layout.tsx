import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

export default function OnboardingLayout() {
  return (
    <Stack screenLayout={keyboardScreenLayout} screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="role" />
      <Stack.Screen name="date" />
      <Stack.Screen name="city" />
    </Stack>
  );
}
