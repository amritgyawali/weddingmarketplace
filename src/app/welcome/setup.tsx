import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ChoiceChips, KButton, KField, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { ONBOARDING_CITIES } from '@/data/cities';
import { VENDOR_CATEGORIES } from '@/data/categories';
import { PLATFORM_ACCESS_CODE } from '@/data/seed';
import { FREELANCE_SKILLS } from '@/data/skills';
import { VENDORS } from '@/data/vendors';
import { VENUES } from '@/data/venues';
import { completeLogin, onAccountCreated } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';
import type { Account, PlatformTeam } from '@/types/platform';

const TEAMS: PlatformTeam[] = ['Genie Planning', 'Wedding Operations', 'Vendor Success', 'Admin'];
const CITY_OPTIONS = [...ONBOARDING_CITIES, 'Udaipur', 'Goa'];

function SetupForm({ phone }: { phone: string }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const register = useSession((s) => s.register);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState<string>('Bangalore');
  // vendor
  const [businessName, setBusinessName] = useState('');
  const [categoryId, setCategoryId] = useState('venues');
  const [claimQuery, setClaimQuery] = useState('');
  const [claimed, setClaimed] = useState<{ id: string; kind: 'venue' | 'vendor'; name: string } | null>(null);
  // freelancer
  const [skills, setSkills] = useState<string[]>([]);
  const [dayRate, setDayRate] = useState('');
  const [bio, setBio] = useState('');
  // platform
  const [team, setTeam] = useState<PlatformTeam>('Genie Planning');
  const [accessCode, setAccessCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const q = claimQuery.trim().toLowerCase();
  const listings =
    t.role === 'vendor'
      ? (categoryId === 'venues'
          ? VENUES.filter((v) => v.city === city).map((v) => ({ id: v.id, kind: 'venue' as const, name: v.name, sub: `${v.type} · ${v.locality}` }))
          : VENDORS.filter((v) => v.categoryId === categoryId && v.city === city).map((v) => ({ id: v.id, kind: 'vendor' as const, name: v.name, sub: v.subcategoryId.replace(/-/g, ' ') }))
        )
          .filter((l) => !q || l.name.toLowerCase().includes(q))
          .slice(0, 6)
      : [];

  const submit = () => {
    const next: Record<string, string | null> = {
      name: name.trim().length < 2 ? 'Enter your full name' : null,
      email: email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email' : null,
      business: t.role === 'vendor' && !claimed && businessName.trim().length < 3 ? 'Enter your business name or claim a listing' : null,
      skills: t.role === 'freelancer' && !skills.length ? 'Pick at least one skill' : null,
      rate: t.role === 'freelancer' && !(Number(dayRate) > 0) ? 'Enter your day rate' : null,
      code: t.role === 'platform' && accessCode.trim().toUpperCase() !== PLATFORM_ACCESS_CODE ? 'Invalid team access code' : null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const base: Omit<Account, 'id' | 'createdAt' | 'verified'> = {
      role: t.role,
      name: name.trim(),
      phone,
      email: email.trim() || undefined,
      city,
    };
    const extra: Partial<Account> =
      t.role === 'vendor'
        ? {
            businessName: claimed?.name ?? businessName.trim(),
            categoryId,
            listingKind: claimed?.kind ?? (categoryId === 'venues' ? 'venue' : 'vendor'),
            listingId: claimed?.id ?? `own_${Date.now().toString(36)}`,
          }
        : t.role === 'freelancer'
          ? { skills, dayRate: Number(dayRate), bio: bio.trim(), available: true, rating: 5 }
          : t.role === 'platform'
            ? { team }
            : {};
    const account = register({ ...base, ...extra });
    onAccountCreated(account);
    completeLogin(account);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Create your account" subtitle={`${t.label} · +977 ${phone}`} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
          <KField label={t.role === 'vendor' ? 'Owner / manager name' : 'Full name'} value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" error={errors.name} />
          <KField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} />
          <View style={{ gap: 6 }}>
            <Text size={13} weight="semibold" color={t.c.muted}>
              {t.role === 'customer' ? 'Wedding city' : 'Based in'}
            </Text>
            <ChoiceChips options={CITY_OPTIONS} selected={[city]} onToggle={(c) => { setCity(c); setClaimed(null); }} />
          </View>

          {t.role === 'vendor' && (
            <>
              <View style={{ gap: 6 }}>
                <Text size={13} weight="semibold" color={t.c.muted}>
                  Business category
                </Text>
                <ChoiceChips
                  options={VENDOR_CATEGORIES.map((c) => c.title)}
                  selected={[VENDOR_CATEGORIES.find((c) => c.id === categoryId)!.title]}
                  onToggle={(title) => {
                    setCategoryId(VENDOR_CATEGORIES.find((c) => c.title === title)!.id);
                    setClaimed(null);
                  }}
                />
              </View>
              <Card style={{ gap: 10 }}>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  Already listed on Vivah?
                </Text>
                <Text size={13} color={t.c.muted}>
                  Claim your listing to receive its enquiries and reviews.
                </Text>
                <KField placeholder="Search your business" value={claimQuery} onChangeText={setClaimQuery} />
                {listings.map((l) => {
                  const on = claimed?.id === l.id;
                  return (
                    <Pressable key={l.id} onPress={() => setClaimed(on ? null : l)} style={[styles.claim, { borderColor: on ? t.c.primary : t.c.border, backgroundColor: on ? t.c.soft : 'transparent' }]}>
                      <Ionicons name={on ? 'checkmark-circle' : 'business-outline'} size={20} color={on ? t.c.primary : t.c.muted} />
                      <View style={{ flex: 1 }}>
                        <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
                          {l.name}
                        </Text>
                        <Text size={12} color={t.c.muted} numberOfLines={1}>
                          {l.sub}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                {!listings.length && (
                  <Text size={12} color={t.c.subtle}>
                    No listings match in {city}.
                  </Text>
                )}
              </Card>
              {!claimed && <KField label="…or register a new business" value={businessName} onChangeText={setBusinessName} placeholder="Business name" error={errors.business} />}
            </>
          )}

          {t.role === 'freelancer' && (
            <>
              <View style={{ gap: 6 }}>
                <Text size={13} weight="semibold" color={t.c.muted}>
                  Your skills
                </Text>
                <ChoiceChips options={[...FREELANCE_SKILLS]} selected={skills} onToggle={(s) => setSkills((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))} />
                {!!errors.skills && (
                  <Text size={12} color={t.c.danger}>
                    {errors.skills}
                  </Text>
                )}
              </View>
              <KField label="Day rate" value={dayRate} onChangeText={(v) => setDayRate(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="NPR" placeholder="8000" error={errors.rate} />
              <KField label="Short bio" value={bio} onChangeText={setBio} multiline placeholder="Experience, style, equipment…" />
            </>
          )}

          {t.role === 'platform' && (
            <>
              <View style={{ gap: 6 }}>
                <Text size={13} weight="semibold" color={t.c.muted}>
                  Team
                </Text>
                <ChoiceChips options={TEAMS} selected={[team]} onToggle={(v) => setTeam(v as PlatformTeam)} />
              </View>
              <KField
                label="Team access code"
                value={accessCode}
                onChangeText={setAccessCode}
                autoCapitalize="characters"
                placeholder={`Demo code: ${PLATFORM_ACCESS_CODE}`}
                error={errors.code}
              />
            </>
          )}

          {(t.role === 'vendor' || t.role === 'freelancer') && (
            <View style={[styles.note, { backgroundColor: t.c.soft }]}>
              <Ionicons name="shield-checkmark-outline" size={18} color={t.c.primary} />
              <Text size={12} color={t.c.text} style={{ flex: 1 }}>
                Your profile goes to the Vivah team for verification. You can start working right away — the Verified badge appears once approved.
              </Text>
            </View>
          )}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 14) }]}>
          <KButton label="Create account" size="lg" onPress={submit} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function SetupScreen() {
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const role = useSession((s) => s.selectedRole) ?? 'customer';
  const fontsReady = useRoleFonts('all');
  if (!fontsReady) return null;
  return (
    <RoleThemeProvider role={role}>
      <SetupForm phone={phone ?? ''} />
    </RoleThemeProvider>
  );
}

const styles = StyleSheet.create({
  claim: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.2, borderRadius: 12, padding: 10 },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, alignItems: 'flex-start' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
});
