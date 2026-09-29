import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { colors, fonts, GUTTER, inputReset, radius } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const CODE_PATTERN = /^[A-Z0-9]{6}$/;

/** Invite codes let family & friends join a couple's wedding planning space. */
export default function JoinWeddingScreen() {
  const insets = useSafeAreaInsets();
  const joinWedding = useAppStore((s) => s.joinWedding);
  const joined = useAppStore((s) => s.joinedWeddings);
  const hasOnboarded = useAppStore((s) => s.hasOnboarded);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submit = () => {
    const normalized = code.trim().toUpperCase();
    if (!CODE_PATTERN.test(normalized)) {
      setError('Invite codes are 6 letters or numbers, e.g. RIYA24');
      triggerHaptic('medium');
      return;
    }
    joinWedding(normalized);
    triggerHaptic('success');
    setSuccess(true);
  };

  if (success) {
    return (
      <View style={[styles.root, styles.center, { paddingBottom: insets.bottom + 24 }]}>
        <Animated.View entering={ZoomIn.springify()} style={styles.icon}>
          <Ionicons name="people" size={42} color={colors.white} />
        </Animated.View>
        <Text size={24} weight="bold" color={colors.heading} align="center">
          You’re in!
        </Text>
        <Text size={15} color={colors.textBody} align="center" style={{ maxWidth: 300 }}>
          You’ve joined the wedding with code {code.trim().toUpperCase()}. You’ll see shared checklists and updates once the couple approves.
        </Text>
        <Button
          label={hasOnboarded ? 'Done' : 'Continue'}
          size="lg"
          style={{ alignSelf: 'stretch', marginTop: 20 }}
          onPress={() => {
            router.back();
            if (!hasOnboarded) router.push('/onboarding/role');
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Join a Wedding" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.body}>
          <Text size={26} weight="bold" color={colors.heading}>
            Have an invite code?
          </Text>
          <Text size={15} color={colors.textBody} lineHeight={22}>
            Enter the 6-character code shared by the bride or groom to help plan their big day.
          </Text>
          <TextInput
            value={code}
            onChangeText={(t) => {
              setCode(t.toUpperCase());
              setError(null);
            }}
            placeholder="ABC123"
            placeholderTextColor={colors.textSubtle}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            autoFocus
            style={[styles.code, inputReset, !!error && { borderColor: colors.danger }]}
            onSubmitEditing={submit}
          />
          {!!error && (
            <Text size={13} color={colors.danger}>
              {error}
            </Text>
          )}
          {joined.length > 0 && (
            <Text size={13} color={colors.textMuted}>
              Already joined: {joined.join(', ')}
            </Text>
          )}
        </View>
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Button label="Join Wedding" size="lg" onPress={submit} disabled={code.trim().length < 6} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 12 },
  icon: { width: 92, height: 92, borderRadius: 46, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  body: { flex: 1, padding: GUTTER, gap: 14 },
  code: {
    marginTop: 10,
    height: 64,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: 28,
    letterSpacing: 8,
    color: colors.textStrong,
  },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12 },
});
