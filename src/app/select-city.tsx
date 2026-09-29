import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from 'react-native';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { colors, GUTTER } from '@/constants/theme';
import { CITIES, CITY_SECTIONS } from '@/data/cities';
import { useAppStore } from '@/store/useAppStore';
import type { City } from '@/types';

/** Map reverse-geocoded names onto the cities we serve. */
function matchCity(parts: (string | null | undefined)[]): City | undefined {
  const aliases: Record<string, string> = { bengaluru: 'Bangalore', 'new delhi': 'Delhi NCR', delhi: 'Delhi NCR', gurugram: 'Delhi NCR', noida: 'Delhi NCR' };
  for (const raw of parts) {
    if (!raw) continue;
    const p = raw.toLowerCase();
    const alias = Object.entries(aliases).find(([k]) => p.includes(k));
    const name = alias?.[1] ?? raw;
    const hit = CITIES.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (hit) return hit;
  }
  return undefined;
}

export default function SelectCityScreen() {
  const city = useAppStore((s) => s.city);
  const setCity = useAppStore((s) => s.setCity);
  const [query, setQuery] = useState('');
  const [locating, setLocating] = useState(false);

  const q = query.trim().toLowerCase();
  const sections = CITY_SECTIONS.map((s) => ({
    title: s.title,
    data: CITIES.filter((c) => c.group === s.group && (!q || c.name.toLowerCase().includes(q) || c.state?.toLowerCase().includes(q))),
  })).filter((s) => s.data.length);

  const choose = (name: string) => {
    triggerHaptic('selection');
    setCity(name);
    router.back();
  };

  const detectLocation = async () => {
    try {
      setLocating(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        toast('Location permission denied', 'alert-circle');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [place] = await Location.reverseGeocodeAsync(pos.coords);
      const match = matchCity([place?.city, place?.subregion, place?.district, place?.region]);
      if (match) {
        toast(`Showing results for ${match.name}`, 'location');
        choose(match.name);
      } else {
        toast(`We're not in ${place?.city ?? 'your city'} yet`, 'information-circle');
      }
    } catch {
      toast('Could not detect your location', 'alert-circle');
    } finally {
      setLocating(false);
    }
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Select City/State" border={false} />
      <SectionList
        sections={sections}
        keyExtractor={(c) => c.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListHeaderComponent={
          <View>
            <Pressable onPress={detectLocation} disabled={locating} style={styles.location} accessibilityRole="button">
              {locating ? <ActivityIndicator color={colors.primary} /> : <MaterialIcons name="my-location" size={26} color={colors.textStrong} />}
              <Text size={17} color={colors.text}>
                {locating ? 'Detecting your location…' : 'Use Current Location'}
              </Text>
            </Pressable>
            <SearchBar
              placeholder="Search Cities/States..."
              value={query}
              onChangeText={setQuery}
              height={44}
              style={{ marginHorizontal: GUTTER - 10, marginBottom: 10 }}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <Text size={18} weight="semibold" color={colors.heading} style={styles.sectionTitle}>
            {section.title}
          </Text>
        )}
        renderItem={({ item }) => {
          const active = item.name === city;
          return (
            <Pressable
              onPress={() => choose(item.name)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.bgSoft }]}>
              <Text size={17} color={active ? colors.primary : colors.text} weight={active ? 'medium' : 'regular'}>
                {item.name}
              </Text>
              {active && <Ionicons name="checkmark" size={20} color={colors.primary} />}
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <Text size={15} color={colors.textMuted} align="center" style={{ marginTop: 40 }}>
            No city matches “{query}”
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  location: { flexDirection: 'row', alignItems: 'center', gap: 22, paddingHorizontal: GUTTER - 4, paddingTop: 26, paddingBottom: 30 },
  sectionTitle: { paddingHorizontal: GUTTER - 10, paddingTop: 22, paddingBottom: 4 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: GUTTER - 4,
    paddingVertical: 13,
  },
});
