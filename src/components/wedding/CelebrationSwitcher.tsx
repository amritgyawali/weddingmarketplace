import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { occasionOf } from '@/services/experience';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/**
 * The couple's celebrations side by side (a wedding now, a pasni later). The
 * planner works on the one picked here; "Plan another" runs the onboarding
 * questions again and adds a project.
 */
export function CelebrationSwitcher() {
  const account = useAccount();
  const occasions = useDb((s) => s.occasions);
  const setActive = useAppStore((s) => s.setActiveProject);
  const { project, projects } = useCustomerWorkspace(account.id);
  const live = projects.filter((p) => p.status !== 'CANCELLED');
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {live.map((p) => {
        const on = p.id === project?.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => {
              triggerHaptic('selection');
              setActive(p.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${p.title}, ${occasionOf(p, occasions).label}`}
            style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.bgSoft : colors.white }]}>
            <Text size={13} weight="semibold" color={colors.heading} numberOfLines={1}>
              {p.title}
            </Text>
            <Text size={12} color={colors.textMuted} numberOfLines={1}>
              {occasionOf(p, occasions).label} · {formatShortDate(p.weddingDate)}
            </Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => router.push('/celebrate')} accessibilityRole="button" style={[styles.chip, styles.add]}>
        <Ionicons name="add" size={18} color={colors.primary} />
        <Text size={13} weight="semibold" color={colors.primary}>
          Plan another
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 140, maxWidth: 220, gap: 1 },
  add: { flexDirection: 'row', alignItems: 'center', gap: 6, borderColor: colors.border, borderStyle: 'dashed', minWidth: 0, backgroundColor: colors.white },
});

