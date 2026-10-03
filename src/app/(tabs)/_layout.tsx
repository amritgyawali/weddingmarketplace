import { Tabs } from 'expo-router';
import { View } from 'react-native';

import { TabBar } from '@/components/navigation/TabBar';
import { CoupleTour } from '@/components/tour/AppTour';
import { colors } from '@/constants/theme';
import { keyboardScreenLayout } from '@/components/ui/Keyboard';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
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
        <Tabs.Screen name="wedding" options={{ title: 'My Wedding' }} />
        {/* Planner packages: kept as a route (home banner, menu, links) but no longer in the bar. */}
        <Tabs.Screen name="genie" options={{ title: 'Planner' }} />
      </Tabs>
      {/* First-run tour: small cards that point at search, the tabs, messages and the menu. */}
      <CoupleTour />
    </View>
  );
}
