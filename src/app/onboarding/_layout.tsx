import { Stack } from 'expo-router';
import { Platform } from 'react-native';

import { colors } from '@/constants/theme';

export const unstable_settings = { initialRouteName: 'role' };

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bgSoft },
        animation: Platform.OS === 'android' ? 'slide_from_right' : 'default',
      }}>
      <Stack.Screen name="role" />
      <Stack.Screen name="date" />
      <Stack.Screen name="city" />
    </Stack>
  );
}
