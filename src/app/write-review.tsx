import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { StarInput } from '@/components/ui/Rating';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { colors, GUTTER, radius } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import { formatShortDate } from '@/utils/format';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
const MIN_LENGTH = 30;

export default function WriteReviewScreen() {
  const params = useLocalSearchParams<{ name?: string }>();
  const insets = useSafeAreaInsets();
  const addReview = useAppStore((s) => s.addReview);
  const past = useAppStore((s) => s.reviews);
  const [target, setTarget] = useState(params.name ?? '');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [touched, setTouched] = useState(false);

  const errors = {
    target: target.trim().length < 2 ? 'Enter the venue or vendor name' : null,
    rating: rating === 0 ? 'Tap a star to rate' : null,
    text: text.trim().length < MIN_LENGTH ? `Write at least ${MIN_LENGTH} characters (${text.trim().length}/${MIN_LENGTH})` : null,
  };
  const valid = !errors.target && !errors.rating && !errors.text;

  const submit = () => {
    setTouched(true);
    if (!valid) return;
    addReview({ targetName: target.trim(), rating, text: text.trim() });
    toast('Thanks! Your review has been submitted');
    router.back();
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Write a Review" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text size={15} color={colors.textBody} lineHeight={22}>
            Your review helps thousands of couples hire their wedding team with confidence.
          </Text>
          <Field
            label="Venue / vendor you hired"
            value={target}
            onChangeText={setTarget}
            placeholder="e.g. Golden Hour Studio"
            error={touched ? errors.target : null}
          />
          <View style={styles.stars}>
            <StarInput value={rating} onChange={setRating} />
            <Text size={15} weight="semibold" color={rating ? colors.primary : colors.textMuted}>
              {rating ? LABELS[rating] : 'Tap to rate'}
            </Text>
            {touched && errors.rating && (
              <Text size={12} color={colors.danger}>
                {errors.rating}
              </Text>
            )}
          </View>
          <Field
            label="Your experience"
            value={text}
            onChangeText={setText}
            placeholder="What did you love? What could be better?"
            multiline
            maxLength={1500}
            error={touched ? errors.text : null}
          />

          {past.length > 0 && (
            <View style={{ gap: 10, marginTop: 10 }}>
              <Text size={17} weight="bold" color={colors.heading}>
                Your reviews
              </Text>
              {past.map((r) => (
                <View key={r.id} style={styles.past}>
                  <Text size={15} weight="semibold" color={colors.heading}>
                    {r.targetName} · {'★'.repeat(r.rating)}
                  </Text>
                  <Text size={13} color={colors.textBody} numberOfLines={2}>
                    {r.text}
                  </Text>
                  <Text size={11} color={colors.textSubtle}>
                    {formatShortDate(r.createdAt)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Button label="Submit Review" size="lg" onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER, gap: 20 },
  stars: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  past: { padding: 14, borderRadius: radius.md, backgroundColor: colors.bgSoft, gap: 4 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline },
});
