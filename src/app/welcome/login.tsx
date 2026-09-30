import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KButton } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { inputReset } from '@/constants/theme';
import { DEMO_ACCOUNTS, DEMO_OTP } from '@/data/seed';
import { completeLogin } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';
import { isNepalMobile } from '@/utils/format';

function LoginForm() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const findAccount = useSession((s) => s.findAccount);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const otpRef = useRef<TextInput>(null);
  const demo = DEMO_ACCOUNTS.find((a) => a.role === t.role)!;

  const sendOtp = async () => {
    if (!isNepalMobile(phone)) {
      setError('Enter a valid Nepali mobile number (98XXXXXXXX)');
      triggerHaptic('medium');
      return;
    }
    setError(null);
    setBusy(true);
    await new Promise((r) => setTimeout(r, 700)); // simulated SMS gateway
    setBusy(false);
    setStep('otp');
    setTimeout(() => otpRef.current?.focus(), 250);
  };

  const verify = async (code = otp) => {
    if (code !== DEMO_OTP) {
      setError('Incorrect OTP. Use 1234 in this demo.');
      triggerHaptic('medium');
      return;
    }
    setBusy(true);
    await new Promise((r) => setTimeout(r, 500));
    setBusy(false);
    const existing = findAccount(phone, t.role);
    if (existing?.suspended) {
      setError('This account is suspended. Contact Vivah support to restore access.');
      return;
    }
    if (existing) completeLogin(existing);
    else router.push({ pathname: '/welcome/setup', params: { phone } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StatusBar style="dark" />
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={t.c.textStrong} />
        </Pressable>
        <Text size={14} color={t.c.muted}>
          {t.label}
        </Text>
        <Text serif size={26} weight="bold" color={t.c.textStrong} lineHeight={36}>
          {step === 'phone' ? 'Log in with your mobile number' : 'Enter the code we sent'}
        </Text>
        <Text size={14} color={t.c.muted}>
          {step === 'phone' ? 'We’ll text you a 4-digit code. No password needed.' : `Sent to +977 ${phone}`}
        </Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          {step === 'phone' ? (
            <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 12 }}>
              <Text size={13} weight="semibold" color={t.c.muted}>
                Mobile number
              </Text>
              <View style={[styles.phone, { borderColor: error ? t.c.danger : t.c.border, backgroundColor: t.c.surface }]}>
                <Text size={17} weight="medium" color={t.c.muted}>
                  +977
                </Text>
                <View style={[styles.vr, { backgroundColor: t.c.border }]} />
                <TextInput
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v.replace(/\D/g, '').slice(0, 10));
                    setError(null);
                  }}
                  placeholder="98XXXXXXXX"
                  placeholderTextColor={t.c.subtle}
                  keyboardType="phone-pad"
                  autoFocus
                  maxLength={10}
                  style={[styles.phoneInput, inputReset, { color: t.c.textStrong, fontFamily: t.fonts.semibold }]}
                  onSubmitEditing={sendOtp}
                />
              </View>
              {!!error && (
                <Text size={13} color={t.c.danger}>
                  {error}
                </Text>
              )}
              <KButton label="Send OTP" size="lg" onPress={sendOtp} loading={busy} disabled={phone.length < 10} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 12 }}>
              <TextInput
                ref={otpRef}
                value={otp}
                onChangeText={(v) => {
                  const code = v.replace(/\D/g, '').slice(0, 4);
                  setOtp(code);
                  setError(null);
                  if (code.length === 4) verify(code);
                }}
                keyboardType="number-pad"
                maxLength={4}
                placeholder="0000"
                placeholderTextColor={t.c.subtle}
                style={[styles.otp, inputReset, { color: t.c.textStrong, borderColor: error ? t.c.danger : t.c.border, backgroundColor: t.c.surface, fontFamily: t.fonts.semibold }]}
              />
              {!!error && (
                <Text size={13} color={t.c.danger}>
                  {error}
                </Text>
              )}
              <Text size={12} color={t.c.muted}>
                Demo mode: the OTP is {DEMO_OTP}.
              </Text>
              <KButton label="Continue" size="lg" onPress={() => verify()} loading={busy} disabled={otp.length < 4} />
              <KButton label="Change number" variant="ghost" size="sm" onPress={() => { setStep('phone'); setOtp(''); }} />
            </Animated.View>
          )}

          <View style={[styles.demo, { borderTopColor: t.c.border }]}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              Just looking around?
            </Text>
            <Text size={13} color={t.c.muted}>
              Use the demo account for {demo.businessName ?? demo.name}. It already has projects, quotations and gigs in it.
            </Text>
            <KButton label={`Continue as ${demo.businessName ?? demo.name}`} variant="secondary" size="sm" style={{ alignSelf: 'flex-start', marginTop: 6 }} onPress={() => completeLogin(demo)} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function LoginScreen() {
  const role = useSession((s) => s.selectedRole) ?? 'customer';
  const fontsReady = useRoleFonts('all');
  if (!fontsReady) return null;
  return (
    <RoleThemeProvider role={role}>
      <LoginForm />
    </RoleThemeProvider>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 20, paddingBottom: 8, gap: 2 },
  back: { width: 36, height: 40, justifyContent: 'center', marginLeft: -6, marginBottom: 14 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14 },
  vr: { width: 1, height: 22 },
  phoneInput: { flex: 1, fontSize: 18, letterSpacing: 0.5, height: '100%' },
  otp: { height: 56, borderRadius: 8, borderWidth: 1, textAlign: 'center', fontSize: 26, letterSpacing: 14 },
  demo: { gap: 2, marginTop: 18, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
});
