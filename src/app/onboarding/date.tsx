import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { Button } from '@/components/ui/Button';
import { Calendar } from '@/components/ui/Calendar';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import { daysUntil, formatLongDate } from '@/utils/format';

export default function WeddingDateScreen() {
  const weddingDate = useAppStore((s) => s.weddingDate);
  const setWeddingDate = useAppStore((s) => s.setWeddingDate);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(weddingDate);

  const confirm = () => {
    if (!draft) return;
    setWeddingDate(draft);
    setOpen(false);
    setTimeout(() => router.push('/onboarding/city'), 350);
  };

  return (
    <OnboardingStep step={1} title={'Do you have a\nwedding date?'} onSkip={() => router.push('/onboarding/city')}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Select wedding date"
        style={styles.field}>
        <Text size={24} color={weddingDate ? colors.heading : colors.textMuted} weight={weddingDate ? 'semibold' : 'regular'}>
          {weddingDate ? formatLongDate(weddingDate) : 'Select Date'}
        </Text>
        {weddingDate && <Ionicons name="create-outline" size={20} color={colors.primary} />}
      </Pressable>
      {weddingDate && (
        <Animated.View entering={FadeIn} style={styles.countdown}>
          <Ionicons name="heart" size={14} color={colors.primary} />
          <Text size={14} color={colors.textBody}>
            {daysUntil(weddingDate)} days to go!
          </Text>
        </Animated.View>
      )}

      <Sheet visible={open} onClose={() => setOpen(false)} title="Select your wedding date">
        <View style={styles.sheetBody}>
          <Calendar value={draft} onChange={setDraft} />
          <Button label={draft ? `Confirm ${formatLongDate(draft)}` : 'Pick a date'} disabled={!draft} onPress={confirm} size="lg" />
        </View>
      </Sheet>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  sheetBody: { paddingHorizontal: 20, gap: 18, paddingTop: 4 },
});
