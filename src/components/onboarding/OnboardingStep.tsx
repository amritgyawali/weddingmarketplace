import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInLeft, FadeInRight, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/IconButton';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';

function Segment({ filled }: { filled: boolean }) {
  const animated = useAnimatedStyle(() => ({
    backgroundColor: withTiming(filled ? colors.primary : colors.divider, { duration: 280 }),
  }));
  return <Animated.View style={[styles.segment, animated]} />;
}

/** Thin segmented bar; done and current questions are filled. */
export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View style={styles.segments} accessibilityLabel={`Question ${Math.min(current + 1, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <Segment key={i} filled={i <= current} />
      ))}
    </View>
  );
}

export interface Crumb {
  label: string;
  /** Step to return to when the crumb is tapped. */
  step: number;
}

/**
 * Frame for the couple's first-run questions: back, progress, the answers so
 * far (tap one to change it), the question, the answer area and a sticky footer.
 */
export function OnboardingFrame({
  stepKey,
  direction,
  current,
  total,
  onBack,
  crumbs,
  onCrumb,
  title,
  subtitle,
  children,
  footer,
}: {
  stepKey: string;
  direction: 1 | -1;
  current: number;
  total: number;
  onBack: () => void;
  crumbs: Crumb[];
  onCrumb: (step: number) => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const enter = (direction > 0 ? FadeInRight : FadeInLeft).duration(280);

  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <View style={styles.topRow}>
          <BackButton onPress={onBack} />
          <Text size={13} color={colors.textMuted}>
            {current < total ? `${current + 1} of ${total}` : 'Almost done'}
          </Text>
          <View style={{ width: 38 }} />
        </View>
        <View style={styles.inner}>
          <StepIndicator current={current} total={total} />
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: 140 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.inner}>
            {crumbs.length > 0 && (
              <View style={styles.crumbs}>
                {crumbs.map((c, i) => (
                  <View key={c.label} style={styles.crumbItem}>
                    {i > 0 && <View style={styles.crumbDot} />}
                    <Pressable
                      onPress={() => {
                        triggerHaptic('selection');
                        onCrumb(c.step);
                      }}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Change ${c.label}`}>
                      <Text size={13} color={colors.textBody} style={styles.crumbText}>
                        {c.label}
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
            <Animated.View key={stepKey} entering={enter}>
              <Text serif weight="bold" size={28} lineHeight={38} color={colors.heading}>
                {title}
              </Text>
              {subtitle && (
                <Text size={15} color={colors.textMuted} style={{ marginTop: 6 }}>
                  {subtitle}
                </Text>
              )}
              <View style={styles.content}>{children}</View>
            </Animated.View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={[styles.inner, { gap: 6 }]}>{footer}</View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

/** One answer in a single- or multi-choice question. */
export function ChoiceRow({
  title,
  caption,
  selected,
  onPress,
  compact,
  index = 0,
}: {
  title: string;
  caption?: string;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
  /** Position in the list, for a short staggered entrance. */
  index?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.duration(260).delay(80 + index * 40)} style={compact ? styles.compactWrap : undefined}>
      <Pressable
        onPress={() => {
          triggerHaptic('selection');
          onPress();
        }}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          styles.choice,
          compact && styles.choiceCompact,
          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primaryTint : pressed ? colors.bgSoft : colors.white },
        ]}>
        <View style={{ flex: 1 }}>
          <Text size={compact ? 15 : 16} weight="semibold" color={colors.heading} numberOfLines={1}>
            {title}
          </Text>
          {caption && (
            <Text size={13} color={colors.textMuted} numberOfLines={1}>
              {caption}
            </Text>
          )}
        </View>
        <View style={[styles.radio, selected && { borderColor: colors.primary, backgroundColor: colors.primary }]}>
          {selected && <Ionicons name="checkmark" size={13} color={colors.white} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  top: { paddingHorizontal: GUTTER, paddingBottom: 10, backgroundColor: colors.white },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginLeft: -8, marginBottom: 6 },
  inner: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  segments: { flexDirection: 'row', gap: 5 },
  segment: { flex: 1, height: 3, borderRadius: 2 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 14 },
  crumbs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', rowGap: 4, marginBottom: 16 },
  crumbItem: { flexDirection: 'row', alignItems: 'center' },
  crumbDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.textSubtle, marginHorizontal: 8 },
  crumbText: { textDecorationLine: 'underline', textDecorationColor: colors.border },
  content: { marginTop: 24, gap: 10 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  compactWrap: { width: '48.5%' },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, minHeight: 64, paddingVertical: 10 },
  choiceCompact: { minHeight: 58, paddingHorizontal: 14 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
