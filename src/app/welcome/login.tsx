import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, KButton } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { inputReset } from '@/constants/theme';
import { DEMO_ACCOUNTS, DEMO_OTP } from '@/data/seed';
import { completeLogin } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';

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
  const light = t.role !== 'freelancer';

  const sendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError('Enter a valid 10-digit mobile number');
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
    if (existing) completeLogin(existing);
    else router.push({ pathname: '/welcome/setup', params: { phone } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StatusBar style={light ? 'light' : 'light'} />
      <LinearGradient colors={t.role === 'freelancer' ? ['#1A1F28', '#0C0F14'] : t.gradient} style={[styles.hero, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" style={styles.back}>
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
        </Pressable>
        <Text size={13} weight="bold" color={t.role === 'freelancer' ? t.c.primary : 'rgba(255,255,255,0.8)'} tracking={1}>
          {t.label.toUpperCase()} LOGIN
        </Text>
        <Text size={30} weight="bold" color="#FFFFFF" lineHeight={36}>
          {step === 'phone' ? 'Welcome! Enter your\nmobile number' : 'Verify your\nnumber'}
        </Text>
        <Text size={14} color="rgba(255,255,255,0.8)" style={{ marginTop: 6 }}>
          {t.tagline}
        </Text>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          {step === 'phone' ? (
            <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 12 }}>
              <Text size={13} weight="semibold" color={t.c.muted}>
                Mobile number
              </Text>
              <View style={[styles.phone, { borderColor: error ? t.c.danger : t.c.border, backgroundColor: t.c.surface }]}>
                <Text size={17} weight="semibold" color={t.c.textStrong}>
                  🇮🇳 +91
                </Text>
                <View style={[styles.vr, { backgroundColor: t.c.border }]} />
                <TextInput
                  value={phone}
                  onChangeText={(v) => {
                    setPhone(v.replace(/\D/g, '').slice(0, 10));
                    setError(null);
                  }}
                  placeholder="98765 43210"
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
              <Text size={14} color={t.c.muted}>
                Enter the 4-digit code sent to +91 {phone}
              </Text>
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
                placeholder="• • • •"
                placeholderTextColor={t.c.subtle}
                style={[styles.otp, inputReset, { color: t.c.textStrong, borderColor: error ? t.c.danger : t.c.primary, backgroundColor: t.c.surface, fontFamily: t.fonts.bold }]}
              />
              {!!error && (
                <Text size={13} color={t.c.danger}>
                  {error}
                </Text>
              )}
              <Text size={12} color={t.c.muted}>
                Demo mode: the OTP is {DEMO_OTP}.
              </Text>
              <KButton label="Verify & continue" size="lg" onPress={() => verify()} loading={busy} disabled={otp.length < 4} />
              <KButton label="Change number" variant="ghost" size="sm" onPress={() => { setStep('phone'); setOtp(''); }} />
            </Animated.View>
          )}

          <Card style={{ gap: 10, marginTop: 10 }}>
            <View style={styles.demoRow}>
              <Ionicons name="sparkles" size={18} color={t.c.primary} />
              <Text size={15} weight="bold" color={t.c.textStrong}>
                Explore with a demo account
              </Text>
            </View>
            <Text size={13} color={t.c.muted}>
              {demo.businessName ?? demo.name} · pre-filled with live projects, quotations and gigs.
            </Text>
            <KButton label={`Continue as ${demo.businessName ?? demo.name}`} variant="secondary" size="sm" onPress={() => completeLogin(demo)} />
          </Card>
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
  hero: { paddingHorizontal: 22, paddingBottom: 28, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, gap: 4 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 58, borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16 },
  vr: { width: 1, height: 26 },
  phoneInput: { flex: 1, fontSize: 19, letterSpacing: 1, height: '100%' },
  otp: { height: 64, borderRadius: 14, borderWidth: 1.5, textAlign: 'center', fontSize: 28, letterSpacing: 16 },
  demoRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
