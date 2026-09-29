import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { Chip } from '@/components/ui/Chip';
import { useAppStore } from '@/store/useAppStore';
import type { Role } from '@/types';

const ROLES: { id: Role; label: string }[] = [
  { id: 'bride', label: 'Bride' },
  { id: 'groom', label: 'Groom' },
  { id: 'other', label: 'Other' },
];

export default function RoleScreen() {
  const storedRole = useAppStore((s) => s.role);
  const setRole = useAppStore((s) => s.setRole);
  const [selected, setSelected] = useState<Role | null>(storedRole);

  const choose = (role: Role) => {
    setSelected(role);
    setRole(role);
    // Short pause so the pink selection state registers before advancing.
    setTimeout(() => router.push('/onboarding/date'), 260);
  };

  return (
    <OnboardingStep step={0} title="Tell us who you are">
      <View style={styles.row}>
        {ROLES.map((r) => (
          <Chip
            key={r.id}
            label={r.label}
            variant="elevated"
            size="lg"
            selected={selected === r.id}
            onPress={() => choose(r.id)}
            style={styles.pill}
          />
        ))}
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 18, paddingHorizontal: 4 },
  pill: { flex: 1, height: 44, paddingHorizontal: 0, paddingVertical: 0 },
});
