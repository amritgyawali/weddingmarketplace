import { Tabs } from 'expo-router';

import { TabBar } from '@/components/navigation/TabBar';
import { colors } from '@/constants/theme';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

export default function TabsLayout() {
  return (
    <Tabs screenLayout={keyboardScreenLayout}
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.white },
        animation: 'fade',
      }}>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="venues" options={{ title: 'Venues' }} />
      <Tabs.Screen name="vendors" options={{ title: 'Vendors' }} />
      <Tabs.Screen name="ideas" options={{ title: 'Ideas' }} />
      <Tabs.Screen name="genie" options={{ title: 'Planner' }} />
    </Tabs>
  );
}
