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
    width: withTiming(index === current ? 62 : 21, { duration: 260 }),
    backgroundColor: withTiming(index <= current ? colors.primary : colors.stepInactive, { duration: 260 }),
  }));
  return <Animated.View style={[styles.pill, animated]} />;
}

/** Progress pills: completed = short pink, current = long pink, upcoming = short grey. */
export function StepIndicator({ current }: { current: number }) {
  return (
    <View style={styles.steps} accessibilityLabel={`Step ${current + 1} of ${STEPS}`}>
      {Array.from({ length: STEPS }, (_, i) => (
        <StepPill key={i} index={i} current={current} />
      ))}
    </View>
  );
}

/**
 * Shared frame for the three onboarding questions: white bar with the back
 * button, off-white body, step indicator, headline and an optional SKIP.
 */
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
      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        {/* The first question has no history (login cleared it): back signs out. */}
        <BackButton onPress={step === 0 || !router.canGoBack() ? logout : undefined} />
      </View>
      <View style={[styles.body, { paddingBottom: insets.bottom + 18 }]}>
        <StepIndicator current={step} />
        <Animated.View entering={FadeInDown.duration(380).delay(60)}>
          <Text weight="bold" size={34} lineHeight={42} color={colors.heading} tracking={-0.8} style={styles.title}>
            {title}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.duration(380).delay(160)} style={styles.content}>
          {children}
        </Animated.View>
        {footer}
        {onSkip && (
          <Pressable onPress={onSkip} hitSlop={16} style={styles.skip} accessibilityRole="button">
            <Text size={17} weight="medium" color={colors.textMuted} tracking={0.6}>
              SKIP
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  topBar: { backgroundColor: colors.white, paddingHorizontal: GUTTER - 4, paddingBottom: 14 },
  body: { flex: 1, paddingHorizontal: GUTTER },
  steps: { flexDirection: 'row', gap: 20, marginTop: 50, marginBottom: 58 },
  pill: { height: 10, borderRadius: 5 },
  title: { marginBottom: 30 },
  content: { flex: 1 },
  skip: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 24 },
});
