import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { acceptLegal, accountFromMe, fetchMe, roleOf } from '@/backend/account';
import { emailOtp, usesEmailSignIn } from '@/backend/auth';
import { registerForPush } from '@/backend/push';
import { KButton } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { inputFont, inputReset, statusBarStyle } from '@/constants/theme';
import { LEGAL_VERSION } from '@/data/legal';
import { DEMO_ACCOUNTS, DEMO_OTP } from '@/data/seed';
import { completeLogin } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useFeatures } from '@/hooks/useFeatures';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';
import type { Account } from '@/types/platform';
import { isNepalMobile } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const NOT_SUPER_ADMIN = 'This isn’t a super admin account. Log in as Vivah staff, or ask a super admin to give you access.';

function LoginForm() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const findAccount = useSession((s) => s.findAccount);
  const upsertAccount = useSession((s) => s.upsertAccount);
  // Supabase builds sign in by email code (owner decision: no SMS in year one); the demo keeps phone + 1234.
  const emailMode = usesEmailSignIn();
  const codeLength = emailMode ? emailOtp.codeLength : DEMO_OTP.length;
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const otpRef = useRef<TextInput>(null);
  // "Super admin" on the role picker: a staff login that only lets super admins in and never signs anyone up.
  const superAdmin = useLocalSearchParams<{ as?: string }>().as === 'super_admin';
  // Super admins land straight in their console once the role guard has switched to the staff app.
  const signIn = (account: Account) => {
    completeLogin(account);
    if (superAdmin) setTimeout(() => router.push('/platform/admin'), 0);
  };
  const demos = DEMO_ACCOUNTS.filter((a) => a.role === t.role && (!superAdmin || a.staffRole === 'super_admin'));
  const demoOn = useFeatures()('login.demo');

  const sendOtp = async () => {
    if (emailMode) {
      if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
        setError(email.trim() ? 'Enter a valid email address, e.g. name@gmail.com' : 'Enter your email address');
        triggerHaptic('medium');
        return;
      }
      setError(null);
      setBusy(true);
      const sent = await emailOtp.start(email);
      setBusy(false);
      if (!sent.ok) {
        setError(sent.error);
        triggerHaptic('medium');
        return;
      }
      setStep('otp');
      setTimeout(() => otpRef.current?.focus(), 250);
      return;
    }
    if (!isNepalMobile(phone)) {
      setError(phone ? 'Enter a valid Nepali mobile number (98XXXXXXXX)' : 'Enter your mobile number');
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

  const verifyEmail = async (code: string) => {
    setBusy(true);
    const session = await emailOtp.verify(email, code);
    if (!session.ok) {
      setBusy(false);
      setError(session.error);
      triggerHaptic('medium');
      return;
    }
    const me = await fetchMe();
    setBusy(false);
    if (!me.ok) return setError(me.error);
    if (superAdmin && !me.value.signedUp) return setError(NOT_SUPER_ADMIN);
    if (!me.value.signedUp) {
      router.push({ pathname: '/welcome/setup', params: { email: email.trim().toLowerCase() } });
      return;
    }
    const role = roleOf(me.value);
    if (!role) {
      setError(me.value.staffRequest?.status === 'REJECTED' ? 'Your staff sign-up wasn’t approved. Ask an admin.' : 'Your staff sign-up is waiting for an admin’s approval. We’ll email you when it’s done.');
      return;
    }
    if (me.value.suspended) return setError('This account is suspended. Contact Vivah support to restore access.');
    if (role !== t.role) return setError(`This email is registered for ${role === 'customer' ? 'couples' : role === 'vendor' ? 'businesses' : role === 'freelancer' ? 'freelancers' : 'the Vivah team'}. Go back and pick that.`);
    // Continuing past the notice below accepts the current Terms and Privacy policy.
    if (me.value.legal !== LEGAL_VERSION) void acceptLegal(LEGAL_VERSION);
    const account = accountFromMe(me.value, role);
    if (superAdmin && account.staffRole !== 'super_admin') return setError(NOT_SUPER_ADMIN);
    upsertAccount(account);
    signIn(account);
    void registerForPush();
  };

  const verify = async (code = otp) => {
    if (code.length < codeLength) {
      setError(code ? `Enter all ${codeLength} digits of the code` : `Enter the ${codeLength}-digit code we sent you`);
      triggerHaptic('medium');
      return;
    }
    if (emailMode) return verifyEmail(code);
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
    if (superAdmin && existing?.staffRole !== 'super_admin') {
      setError(NOT_SUPER_ADMIN);
      triggerHaptic('medium');
      return;
    }
    if (existing) signIn(existing);
    else router.push({ pathname: '/welcome/setup', params: { phone } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StatusBar style={statusBarStyle()} />
      <View style={[styles.hero, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityLabel="Go back" style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={t.c.textStrong} />
        </Pressable>
        <Text size={14} color={t.c.muted}>
          {superAdmin ? 'Super admin' : t.label}
        </Text>
        <Text serif size={26} weight="bold" color={t.c.textStrong} lineHeight={36}>
          {step === 'phone' ? (emailMode ? 'Log in with your email' : 'Log in with your mobile number') : 'Enter the code we sent'}
        </Text>
        <Text size={14} color={t.c.muted}>
          {step === 'phone' ? (emailMode ? 'We’ll email you a 6-digit code. No password needed.' : 'We’ll text you a 4-digit code. No password needed.') : emailMode ? `Sent to ${email.trim().toLowerCase()}` : `Sent to +977 ${phone}`}
        </Text>
      </View>

      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
          {step === 'phone' && emailMode ? (
            <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 12 }}>
              <Text size={13} weight="semibold" color={t.c.muted}>
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor={t.c.subtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                style={[styles.email, inputReset, { color: t.c.textStrong, borderColor: error ? t.c.danger : t.c.border, backgroundColor: t.c.surface, fontFamily: t.fonts.medium }, inputFont('500')]}
                onSubmitEditing={sendOtp}
              />
              {!!error && (
                <Text size={13} color={t.c.danger}>
                  {error}
                </Text>
              )}
              <KButton label="Email me a code" size="lg" onPress={sendOtp} loading={busy} />
            </Animated.View>
          ) : step === 'phone' ? (
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
                  style={[styles.phoneInput, inputReset, { color: t.c.textStrong, fontFamily: t.fonts.semibold }, inputFont('600')]}
                  onSubmitEditing={sendOtp}
                />
              </View>
              {!!error && (
                <Text size={13} color={t.c.danger}>
                  {error}
                </Text>
              )}
              <KButton label="Send OTP" size="lg" onPress={sendOtp} loading={busy} />
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300)} style={{ gap: 12 }}>
              <TextInput
                ref={otpRef}
                value={otp}
                onChangeText={(v) => {
                  const code = v.replace(/\D/g, '').slice(0, codeLength);
                  setOtp(code);
                  setError(null);
                  if (code.length === codeLength) verify(code);
                }}
                keyboardType="number-pad"
                maxLength={codeLength}
                placeholder={'0'.repeat(codeLength)}
                placeholderTextColor={t.c.subtle}
                style={[styles.otp, inputReset, { color: t.c.textStrong, borderColor: error ? t.c.danger : t.c.border, backgroundColor: t.c.surface, fontFamily: t.fonts.semibold }, inputFont('600')]}
              />
              {!!error && (
                <Text size={13} color={t.c.danger}>
                  {error}
                </Text>
              )}
              <Text size={12} color={t.c.muted}>
                {emailMode ? 'The code works for 10 minutes. Check your spam folder if it hasn’t arrived.' : `Demo mode: the OTP is ${DEMO_OTP}.`}
              </Text>
              <KButton label="Continue" size="lg" onPress={() => verify()} loading={busy} />
              <KButton label={emailMode ? 'Change email' : 'Change number'} variant="ghost" size="sm" onPress={() => { setStep('phone'); setOtp(''); }} />
            </Animated.View>
          )}

          {step === 'phone' && <LegalNotice />}

          {!emailMode && demoOn && demos.length > 0 && (
          <View style={[styles.demo, { borderTopColor: t.c.border }]}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              Just looking around?
            </Text>
            <Text size={13} color={t.c.muted}>
              {demos.length > 1 ? 'Use a demo account. Each one shows a different kind of business, with projects, quotations and gigs already in it.' : `Use the demo account for ${demos[0].businessName ?? demos[0].name}. It already has projects, quotations and gigs in it.`}
            </Text>
            <View style={styles.demoButtons}>
              {demos.map((demo) => (
                <KButton key={demo.id} label={`Continue as ${demo.businessName ?? demo.name}`} variant="secondary" size="sm" onPress={() => signIn(demo)} />
              ))}
            </View>
          </View>
          )}
        </ScrollView>
      </View>
    </View>
  );
}

/** Continuing means accepting the Terms and Privacy policy (recorded on the server with rpc_accept_legal). */
function LegalNotice() {
  const t = useRoleTheme();
  const link = (doc: 'terms' | 'privacy', label: string) => (
    <Link href={{ pathname: '/legal/[doc]', params: { doc } }} style={{ color: t.c.primary, fontFamily: t.fonts.semibold }}>
      {label}
    </Link>
  );
  return (
    <Text size={12} color={t.c.muted} lineHeight={18}>
      By continuing you agree to our {link('terms', 'Terms of use')} and {link('privacy', 'Privacy policy')}.
    </Text>
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
  email: { height: 52, borderRadius: 8, borderWidth: 1, paddingHorizontal: 14, fontSize: 17 },
  otp: { height: 56, borderRadius: 8, borderWidth: 1, textAlign: 'center', fontSize: 26, letterSpacing: 14 },
  demo: { gap: 2, marginTop: 18, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth },
  demoButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
});
