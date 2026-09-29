import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { Chip } from '@/components/ui/Chip';
import { ALL_CITIES, ONBOARDING_CITIES } from '@/data/cities';
import { useAppStore } from '@/store/useAppStore';

export default function WeddingCityScreen() {
  const city = useAppStore((s) => s.city);
  const setCity = useAppStore((s) => s.setCity);
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [selected, setSelected] = useState<string | null>(null);
  const awaitingOther = useRef<string | null>(null);

  const finish = () => completeOnboarding(); // protected routes redirect to the tabs

  const choose = (name: string) => {
    setSelected(name);
    setCity(name);
    setTimeout(finish, 260);
  };

  // Returning from the full city list after tapping "Other".
  useFocusEffect(
    useCallback(() => {
      if (awaitingOther.current !== null && awaitingOther.current !== city) {
        awaitingOther.current = null;
        finish();
      }
      awaitingOther.current = null;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [city]),
  );

  return (
    <OnboardingStep
      step={2}
      title={'Which city is your\nwedding in?'}
      onSkip={() => {
        setCity(ALL_CITIES);
        finish();
      }}>
      <View style={styles.wrap}>
        {ONBOARDING_CITIES.map((name) => (
          <Chip
            key={name}
            label={name}
            variant="elevated"
            size="lg"
            selected={selected === name}
            onPress={() => choose(name)}
          />
        ))}
        <Chip
          label="Other"
          variant="elevated"
          size="lg"
          bold
          onPress={() => {
            awaitingOther.current = city;
            router.push({ pathname: '/select-city', params: { from: 'onboarding' } });
          }}
        />
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 11, rowGap: 14 },
});
