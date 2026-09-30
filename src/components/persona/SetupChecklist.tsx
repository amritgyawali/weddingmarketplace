import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ProgressBar } from '@/components/kit';
import { toolHref } from '@/components/toolkit/hub';
import { Text } from '@/components/ui/Text';
import { useExperience } from '@/hooks/useExperience';
import { setupSteps } from '@/services/experience';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';

/**
 * The vendor home's setup checklist, built from the business's trade ("Add
 * your halls" for venues, "Publish your menu" for caterers). Hidden once
 * every step is done.
 */
export function SetupChecklist() {
  const t = useRoleTheme();
  const account = useAccount();
  const exp = useExperience();
  const entries = useDb((s) => s.toolEntries);
  const portfolio = useDb((s) => s.portfolio);
  const packages = useDb((s) => s.packages);
  const verifications = useDb((s) => s.verifications);
  const providerId = account.listingId ?? account.id;

  const toolCounts: Record<string, number> = {};
  entries.filter((e) => e.ownerId === account.id).forEach((e) => (toolCounts[e.tool] = (toolCounts[e.tool] ?? 0) + 1));
  const steps = setupSteps(exp, {
    confirmed: !!account.personaConfirmedAt,
    toolCounts,
    portfolio: portfolio.filter((p) => p.providerId === providerId).length,
    packages: packages.filter((p) => p.providerId === providerId).length,
    verificationStarted: account.verified || verifications.some((v) => (v.subjectId === account.id || v.subjectId === account.listingId) && v.status !== 'UNVERIFIED'),
  });
  const done = steps.filter((s) => s.done).length;
  if (!steps.length || done === steps.length) return null;

  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <View style={styles.head}>
        <View style={styles.row}>
          <Text size={16} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
            Set up your business
          </Text>
          <Text size={13} color={t.c.muted}>
            {done} of {steps.length} done
          </Text>
        </View>
        <ProgressBar value={done / steps.length} />
      </View>
      {steps.map(({ step, done: complete }) => (
        <Pressable
          key={step.id}
          disabled={complete}
          onPress={() => router.push((step.tool ? toolHref('vendor', step.tool) : step.href) as Href)}
          accessibilityRole="button"
          accessibilityState={{ disabled: complete }}
          style={({ pressed }) => [styles.step, { borderTopColor: t.c.border }, pressed && { backgroundColor: t.c.surfaceAlt }]}>
          <Ionicons name={complete ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={complete ? t.c.success : t.c.subtle} />
          <View style={{ flex: 1 }}>
            <Text size={15} weight={complete ? 'regular' : 'semibold'} color={complete ? t.c.muted : t.c.textStrong}>
              {step.title}
            </Text>
            {!complete && (
              <Text size={13} color={t.c.muted}>
                {step.subtitle}
              </Text>
            )}
          </View>
          {!complete && <Ionicons name="chevron-forward" size={18} color={t.c.subtle} />}
        </Pressable>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
});
