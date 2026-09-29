import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, KButton } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { colors, gradients } from '@/constants/theme';
import { serviceName } from '@/data/services';
import { estimateTotal } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { formatMoneyRange } from '@/utils/format';

const STEPS = [
  { icon: 'call', title: 'Coordinator call', body: 'We confirm dates, guests and priorities with you.' },
  { icon: 'git-compare', title: 'Matching providers', body: 'We check availability, reliability and prices for each service.' },
  { icon: 'document-text', title: 'One quotation', body: 'You get a single package quote — accept or ask for changes.' },
  { icon: 'shield-checkmark', title: 'We manage everything', body: 'Bookings, crew, payments, timeline and wedding-day execution.' },
];

export default function PlanSubmitted() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useDb((s) => s.projects.find((p) => p.id === id));
  if (!project) return null;
  const [lo, hi] = estimateTotal(project.requirements.map((r) => r.serviceId), project.guests, project.events.length);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, padding: 20, gap: 16, paddingBottom: insets.bottom + 30 }}>
        <Animated.View entering={ZoomIn.springify()} style={{ alignItems: 'center', gap: 10 }}>
          <LinearGradient colors={gradients.checklist} style={styles.badge}>
            <Ionicons name="checkmark" size={46} color="#fff" />
          </LinearGradient>
          <Text size={24} weight="extrabold" color={colors.heading} align="center">
            Requirement received!
          </Text>
          <Text size={14} color={colors.textMuted} align="center">
            {project.code} · {project.title} · {project.requirements.length} services
          </Text>
        </Animated.View>

        {project.coordinatorName && (
          <Animated.View entering={FadeInDown.delay(150)}>
            <Card style={styles.row}>
              <Avatar name={project.coordinatorName} size={52} />
              <View style={{ flex: 1 }}>
                <Text size={12} color={colors.textMuted}>
                  Your wedding coordinator
                </Text>
                <Text size={18} weight="bold" color={colors.heading}>
                  {project.coordinatorName}
                </Text>
                <Text size={13} color={colors.textMuted}>
                  Will call you within 2 hours
                </Text>
              </View>
            </Card>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(250)}>
          <Card style={{ gap: 6 }}>
            <Text size={12} weight="bold" color={colors.primary}>
              ESTIMATED FOR YOUR REQUIREMENT
            </Text>
            <Text size={20} weight="extrabold" color={colors.heading}>
              {formatMoneyRange(lo, hi)}
            </Text>
            <Text size={12} color={colors.textMuted}>
              {project.requirements.map((r) => serviceName(r.serviceId)).join(' · ')}
            </Text>
          </Card>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(350)} style={{ gap: 10 }}>
          <Text size={16} weight="bold" color={colors.heading}>
            What happens next
          </Text>
          {STEPS.map((s, i) => (
            <View key={s.title} style={styles.row}>
              <View style={styles.stepIcon}>
                <Ionicons name={s.icon as never} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size={15} weight="semibold" color={colors.heading}>
                  {i + 1}. {s.title}
                </Text>
                <Text size={13} color={colors.textMuted}>
                  {s.body}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <KButton label="Go to My Wedding" icon="heart" size="lg" onPress={() => router.replace('/my-wedding')} />
        <KButton label="Invite guests while you wait" variant="ghost" onPress={() => router.replace('/guests')} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  badge: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
