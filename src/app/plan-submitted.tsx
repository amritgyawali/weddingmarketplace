import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, EmptyBlock, KButton } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { colors, themed } from '@/constants/theme';
import { serviceName } from '@/data/services';
import { estimateTotal } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { formatMoneyRange } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const STEPS = [
  { title: 'Your coordinator calls you', body: 'To confirm the dates, guest count and what matters most to you.' },
  { title: 'We match providers', body: 'Availability, past reliability and price, checked for each service.' },
  { title: 'You get one quotation', body: 'Accept it, or ask for changes and we send a revised version.' },
  { title: 'We run the wedding', body: 'Bookings, crew, payments, the timeline and the day itself.' },
];

export default function PlanSubmitted() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const project = useDb((s) => s.projects.find((p) => p.id === id));
  if (!project) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 40 }]}>
        <EmptyBlock icon="document-text-outline" title="We couldn’t find that plan" message="It may have been removed. Your wedding page has everything you’ve sent us." action="Go to My Wedding" onAction={() => router.replace('/my-wedding')} />
      </View>
    );
  }
  const [lo, hi] = estimateTotal(project.requirements.map((r) => r.serviceId), project.guests, project.events.length);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, padding: 20, gap: 16, paddingBottom: insets.bottom + 30 }}>
        <Animated.View entering={FadeIn.duration(300)} style={{ gap: 6 }}>
          <View style={styles.badge}>
            <Ionicons name="checkmark" size={26} color={colors.success} />
          </View>
          <Text serif size={26} weight="bold" color={colors.heading} lineHeight={36}>
            We’ve got your plan
          </Text>
          <Text size={14} color={colors.textMuted}>
            {project.code} · {project.title} · {project.requirements.length} services
          </Text>
        </Animated.View>

        {project.coordinatorName && (
          <Animated.View entering={FadeInDown.delay(150)}>
            <Card style={styles.row}>
              <Avatar name={project.coordinatorName} size={52} />
              <View style={{ flex: 1 }}>
                <Text size={12} color={colors.textMuted}>
                  Your coordinator
                </Text>
                <Text size={17} weight="semibold" color={colors.heading}>
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
            <Text size={12} weight="medium" color={colors.textMuted}>
              Estimate for what you asked for
            </Text>
            <Text size={20} weight="semibold" color={colors.heading}>
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
            <View key={s.title} style={styles.step}>
              <View style={styles.stepRail}>
                <View style={[styles.stepNum, i === 0 && { backgroundColor: colors.heading, borderColor: colors.heading }]}>
                  <Text size={12} weight="semibold" color={i === 0 ? colors.white : colors.textMuted} lineHeight={15}>
                    {i + 1}
                  </Text>
                </View>
                {i < STEPS.length - 1 && <View style={styles.stepLine} />}
              </View>
              <View style={{ flex: 1, paddingBottom: 16 }}>
                <Text size={15} weight="semibold" color={colors.heading}>
                  {s.title}
                </Text>
                <Text size={13} color={colors.textMuted}>
                  {s.body}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>

        <KButton label="Go to My Wedding" size="lg" onPress={() => router.replace('/my-wedding')} />
        <KButton label="Invite guests while you wait" variant="ghost" onPress={() => router.replace('/guests')} />
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  badge: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.success, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  step: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 24 },
  stepNum: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  stepLine: { flex: 1, width: 1, backgroundColor: colors.border, marginVertical: 2 },
}));
