import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { acceptLegal, accountFromMe, completeSignup, roleOf } from '@/backend/account';
import { signOut } from '@/backend/auth';
import { registerForPush } from '@/backend/push';
import { KButton, KField, showMissing, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { LEGAL_VERSION } from '@/data/legal';
import { completeLogin, onAccountCreated } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';
import { formatPhone, isNepalMobile } from '@/utils/format';
import type { Account } from '@/types/platform';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Couple sign-up details. `signInEmail` is set when the user signed in by email code (Supabase); the demo passes the phone. */
function SetupForm({ phone, signInEmail }: { phone: string; signInEmail?: string }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const register = useSession((s) => s.register);
  const upsertAccount = useSession((s) => s.upsertAccount);
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const submit = async () => {
    const next: Record<string, string | null> = {
      name: name.trim().length < 2 ? 'Enter your full name' : null,
      email: !signInEmail && email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email' : null,
      phone: signInEmail && contactPhone && !isNepalMobile(contactPhone) ? 'Enter a valid Nepali mobile number (98XXXXXXXX)' : null,
      form: null,
    };
    setErrors(next);
    const problem = Object.values(next).find(Boolean);
    if (problem) return showMissing(problem);

    const base: Omit<Account, 'id' | 'createdAt' | 'verified'> = {
      role: 'customer',
      name: name.trim(),
      phone: signInEmail ? contactPhone : phone,
      email: signInEmail ?? (email.trim() || undefined),
      city: 'Kathmandu',
    };
    if (signInEmail) {
      // The server creates the profile and role rows; the device keeps a mirror with the same id.
      setBusy(true);
      const res = await completeSignup('customer', base);
      setBusy(false);
      if (!res.ok) return setErrors({ ...next, form: res.error });
      // They agreed on the sign-in screen; record it now the profile exists.
      await acceptLegal(LEGAL_VERSION);
      if (roleOf(res.value) !== 'customer') {
        void signOut();
        return setErrors({ ...next, form: 'This app is for couples and families planning a celebration.' });
      }
      const account: Account = { ...base, ...accountFromMe(res.value, 'customer') };
      upsertAccount(account);
      onAccountCreated(account);
      completeLogin(account);
      void registerForPush();
      return;
    }
    const account = register(base);
    onAccountCreated(account);
    completeLogin(account);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="What should we call you?" subtitle={`${t.label} · ${signInEmail ?? formatPhone(phone)}`} />
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
          <KField label="Full name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" error={errors.name} />
          {signInEmail ? (
            <KField label="Mobile number (optional, for your coordinator)" value={contactPhone} onChangeText={(v) => setContactPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="98XXXXXXXX" error={errors.phone} />
          ) : (
            <KField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} />
          )}
          {/* Couples answer the wedding city in onboarding, right after this. */}
          <Text size={13} color={t.c.muted}>
            Next, five quick questions about the wedding. It takes under a minute.
          </Text>
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 14) }]}>
          {!!errors.form && (
            <Text size={13} color={t.c.danger} style={{ marginBottom: 8 }}>
              {errors.form}
            </Text>
          )}
          <KButton label="Continue" size="lg" loading={busy} onPress={submit} />
        </View>
      </View>
    </View>
  );
}

export default function SetupScreen() {
  const { phone, email } = useLocalSearchParams<{ phone?: string; email?: string }>();
  const fontsReady = useRoleFonts('customer');
  if (!fontsReady) return null;
  return (
    <RoleThemeProvider role="customer">
      <SetupForm phone={phone ?? ''} signInEmail={email || undefined} />
    </RoleThemeProvider>
  );
}

const styles = StyleSheet.create({
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
