import { Stack } from 'expo-router';

import { colors } from '@/constants/theme';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.white }, animation: 'fade' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="role" />
      <Stack.Screen name="date" />
      <Stack.Screen name="city" />
    </Stack>
  );
}
