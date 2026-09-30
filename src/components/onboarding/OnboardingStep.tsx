import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { logout } from '@/services/auth';

const STEPS = 3;

function StepPill({ index, current }: { index: number; current: number }) {
  const animated = useAnimatedStyle(() => ({
    backgroundColor: withTiming(index <= current ? colors.primary : colors.divider, { duration: 260 }),
  }));
  return <Animated.View style={[styles.pill, animated]} />;
}

/** Three equal segments; done and current ones are filled. */
export function StepIndicator({ current }: { current: number }) {
  return (
    <View style={styles.stepsWrap} accessibilityLabel={`Step ${current + 1} of ${STEPS}`}>
      <Text size={13} color={colors.textMuted}>
        Step {current + 1} of {STEPS}
      </Text>
      <View style={styles.steps}>
        {Array.from({ length: STEPS }, (_, i) => (
          <StepPill key={i} index={i} current={current} />
        ))}
      </View>
    </View>
  );
}

/** Shared frame for the three onboarding questions: back, progress, question, answer, optional skip. */
export function OnboardingStep({
  step,
  title,
  children,
  onSkip,
  footer,
}: {
  step: number;
  title: string;
  children: ReactNode;
  onSkip?: () => void;
  footer?: ReactNode;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
        {/* The first question has no history (login cleared it): back signs out. */}
        <BackButton onPress={step === 0 || !router.canGoBack() ? logout : undefined} />
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + 18 }]}>
        <StepIndicator current={step} />
        <Animated.View entering={FadeInDown.duration(380).delay(60)}>
          <Text serif weight="bold" size={28} lineHeight={38} color={colors.heading} style={styles.title}>
            {title}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(380).delay(160)} style={styles.content}>
          {children}
        </Animated.View>
        {footer}
        {onSkip && (
          <Pressable onPress={onSkip} hitSlop={16} style={styles.skip} accessibilityRole="button">
            <Text size={15} weight="medium" color={colors.textMuted}>
              Skip for now
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  topBar: { backgroundColor: colors.white, paddingHorizontal: GUTTER - 8, paddingBottom: 4 },
  body: { flex: 1, paddingHorizontal: GUTTER },
  stepsWrap: { marginTop: 12, marginBottom: 28, gap: 8 },
  steps: { flexDirection: 'row', gap: 6 },
  pill: { flex: 1, height: 3, borderRadius: 2 },
  title: { marginBottom: 24 },
  content: { flex: 1 },
  skip: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 24 },
});
