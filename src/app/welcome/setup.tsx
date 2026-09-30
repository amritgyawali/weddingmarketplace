import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { accountFromMe, completeSignup, roleOf } from '@/backend/account';
import { signOut } from '@/backend/auth';
import { registerForPush } from '@/backend/push';
import { Card, ChoiceChips, KButton, KField, StackHeader } from '@/components/kit';
import { CraftProfileForm, CraftTiles, draftForCraft, SkillPicker, type FreelancerPersonaDraft } from '@/components/persona/FreelancerPersona';
import { draftForTrade, EssentialsForm, FormPicker, ServicePicker, TradeTiles, type VendorPersonaDraft } from '@/components/persona/VendorPersona';
import { Text } from '@/components/ui/Text';
import { categoryForService } from '@/data/categories';
import { ONBOARDING_CITIES } from '@/data/cities';
import { PLATFORM_ACCESS_CODE } from '@/data/seed';
import { CRAFT_BY_ID, RATE_LABEL } from '@/data/crafts';
import { VENDORS } from '@/data/vendors';
import { VENUES } from '@/data/venues';
import { completeLogin, onAccountCreated } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';
import { formatPhone, isNepalMobile } from '@/utils/format';
import type { Account, PlatformTeam, StaffRole } from '@/types/platform';

const TEAMS: { team: PlatformTeam; role: StaffRole }[] = [
  { team: 'Wedding Coordination', role: 'coordinator' },
  { team: 'Wedding Operations', role: 'coordinator' },
  { team: 'Vendor Success', role: 'support' },
  { team: 'Finance', role: 'finance' },
  { team: 'Admin', role: 'admin' },
];
const CITY_OPTIONS = [...ONBOARDING_CITIES];
const VENDOR_STEPS = ['What does your business do?', 'Which services do you offer?', 'How is your business set up?', 'The essentials', 'Create your account'];
const FREELANCER_STEPS = ['What’s your craft?', 'Your skills', 'Your craft profile', 'Create your account'];

/** Sign-up details. `signInEmail` is set when the user signed in by email code (Supabase); the demo passes the phone. */
function SetupForm({ phone, signInEmail }: { phone: string; signInEmail?: string }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const register = useSession((s) => s.register);
  const upsertAccount = useSession((s) => s.upsertAccount);
  const [contactPhone, setContactPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState<string>('Kathmandu');
  // vendor: trade -> services -> business form -> essentials -> details
  const [vstep, setVstep] = useState(0);
  const [persona, setPersona] = useState<VendorPersonaDraft>(() => draftForTrade('venue'));
  const [businessName, setBusinessName] = useState('');
  const categoryId = categoryForService(persona.primaryService);
  const [claimQuery, setClaimQuery] = useState('');
  const [claimed, setClaimed] = useState<{ id: string; kind: 'venue' | 'vendor'; name: string } | null>(null);
  // freelancer: craft -> skills -> craft profile -> details
  const [fstep, setFstep] = useState(0);
  const [crew, setCrew] = useState<FreelancerPersonaDraft>(() => draftForCraft('photo'));
  const craft = CRAFT_BY_ID[crew.craft];
  const [dayRate, setDayRate] = useState('');
  const [bio, setBio] = useState('');
  const [radius, setRadius] = useState('25 km');
  // vendor + freelancer
  const [panVat, setPanVat] = useState('');
  // platform
  const [team, setTeam] = useState<PlatformTeam>('Wedding Coordination');
  const [accessCode, setAccessCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  const q = claimQuery.trim().toLowerCase();
  const listings =
    t.role === 'vendor'
      ? (persona.primaryService === 'venue'
          ? VENUES.filter((v) => v.city === city).map((v) => ({ id: v.id, kind: 'venue' as const, name: v.name, sub: `${v.type} · ${v.locality}` }))
          : VENDORS.filter((v) => persona.services.includes(v.subcategoryId) && v.city === city).map((v) => ({ id: v.id, kind: 'vendor' as const, name: v.name, sub: v.subcategoryId.replace(/-/g, ' ') }))
        )
          .filter((l) => !q || l.name.toLowerCase().includes(q))
          .slice(0, 6)
      : [];

  const submit = async () => {
    const next: Record<string, string | null> = {
      name: name.trim().length < 2 ? 'Enter your full name' : null,
      email: !signInEmail && email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email' : null,
      phone: signInEmail && contactPhone && !isNepalMobile(contactPhone) ? 'Enter a valid Nepali mobile number (98XXXXXXXX)' : null,
      business: t.role === 'vendor' && !claimed && businessName.trim().length < 3 ? 'Enter your business name or claim a listing' : null,
      rate: t.role === 'freelancer' && !(Number(dayRate) > 0) ? `Enter your rate ${RATE_LABEL[craft.rate]}` : null,
      pan: t.role === 'vendor' && panVat && !/^\d{9}$/.test(panVat) ? 'PAN/VAT numbers have 9 digits' : null,
      // With Supabase the server checks the code an admin set; the demo checks its own.
      code: t.role === 'platform' && (signInEmail ? !accessCode.trim() : accessCode.trim().toUpperCase() !== PLATFORM_ACCESS_CODE) ? (signInEmail ? 'Enter the team access code' : 'Invalid team access code') : null,
      form: null,
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    const base: Omit<Account, 'id' | 'createdAt' | 'verified'> = {
      role: t.role,
      name: name.trim(),
      phone: signInEmail ? contactPhone : phone,
      email: signInEmail ?? (email.trim() || undefined),
      city,
    };
    const extra: Partial<Account> =
      t.role === 'vendor'
        ? {
            businessName: claimed?.name ?? businessName.trim(),
            categoryId,
            listingKind: claimed?.kind ?? (persona.primaryService === 'venue' ? 'venue' : 'vendor'),
            listingId: claimed?.id ?? `own_${Date.now().toString(36)}`,
            panVat: panVat || undefined,
            services: [persona.primaryService, ...persona.services.filter((x) => x !== persona.primaryService)],
            primaryService: persona.primaryService,
            businessForm: persona.businessForm,
            teamSize: persona.businessForm === 'solo' ? 1 : persona.teamSize,
            tradeProfile: persona.tradeProfile,
            personaConfirmedAt: new Date().toISOString(),
          }
        : t.role === 'freelancer'
          ? {
              skills: [crew.primarySkill, ...crew.skills.filter((x) => x !== crew.primarySkill)],
              primarySkill: crew.primarySkill,
              tradeProfile: crew.tradeProfile,
              personaConfirmedAt: new Date().toISOString(),
              dayRate: Number(dayRate),
              eventRate: craft.rate === 'event' ? Number(dayRate) : undefined,
              bio: bio.trim(),
              available: true,
              rating: 5,
              travelRadiusKm: Number(radius.replace(/\D/g, '')),
              languages: ['Nepali'],
            }
          : t.role === 'platform'
            ? { team, staffRole: TEAMS.find((x) => x.team === team)!.role }
            : {};
    if (signInEmail) {
      // The server creates the profile and role rows; the device keeps a mirror with the same id.
      setBusy(true);
      const res = await completeSignup(t.role, { ...base, ...extra }, t.role === 'platform' ? accessCode : undefined);
      setBusy(false);
      if (!res.ok) return setErrors({ ...next, form: res.error });
      const role = roleOf(res.value);
      if (!role) {
        setPending(true);
        void signOut();
        return;
      }
      const account: Account = { ...base, ...extra, ...accountFromMe(res.value, role) };
      upsertAccount(account);
      onAccountCreated(account);
      completeLogin(account);
      void registerForPush();
      return;
    }
    const account = register({ ...base, ...extra });
    onAccountCreated(account);
    completeLogin(account);
  };

  if (pending) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Almost there" subtitle={signInEmail} />
        <View style={{ padding: 18, gap: 14 }}>
          <Card style={{ gap: 8 }}>
            <Text size={16} weight="semibold" color={t.c.textStrong}>
              Thanks, {name.trim().split(' ')[0]}. An admin will approve your staff account.
            </Text>
            <Text size={14} color={t.c.muted}>
              We’ll email you when it’s done. Then sign in with your email again and the operations console opens.
            </Text>
          </Card>
          <KButton label="Back to the start" variant="secondary" onPress={() => router.replace('/welcome')} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader
        title={t.role === 'customer' ? 'What should we call you?' : t.role === 'vendor' ? VENDOR_STEPS[vstep] : t.role === 'freelancer' ? FREELANCER_STEPS[fstep] : 'Create your account'}
        subtitle={
          t.role === 'vendor'
            ? `Step ${vstep + 1} of ${VENDOR_STEPS.length} · ${(signInEmail ?? formatPhone(phone))}`
            : t.role === 'freelancer'
              ? `Step ${fstep + 1} of ${FREELANCER_STEPS.length} · ${(signInEmail ?? formatPhone(phone))}`
              : `${t.label} · ${(signInEmail ?? formatPhone(phone))}`
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 18, gap: 16, paddingBottom: insets.bottom + 110 }} keyboardShouldPersistTaps="handled">
          {t.role === 'vendor' && vstep === 0 && (
            <>
              <Text size={14} color={t.c.muted}>
                Pick the one that fits best. You can add services from other trades next.
              </Text>
              <TradeTiles value={persona.trade} onChange={(trade) => setPersona((d) => (trade === d.trade ? d : draftForTrade(trade, d)))} />
            </>
          )}
          {t.role === 'vendor' && vstep === 1 && <ServicePicker draft={persona} onChange={setPersona} />}
          {t.role === 'vendor' && vstep === 2 && <FormPicker draft={persona} onChange={setPersona} />}
          {t.role === 'vendor' && vstep === 3 && (
            <>
              <Text size={14} color={t.c.muted}>
                Just what couples need to see before they enquire. Everything else can wait.
              </Text>
              <EssentialsForm draft={persona} onChange={setPersona} />
            </>
          )}
          {t.role === 'freelancer' && fstep === 0 && (
            <>
              <Text size={14} color={t.c.muted}>
                Pick the one you do most. You can add skills from other crafts next.
              </Text>
              <CraftTiles value={crew.craft} onChange={(c) => setCrew((d) => (c === d.craft ? d : draftForCraft(c, d)))} />
            </>
          )}
          {t.role === 'freelancer' && fstep === 1 && <SkillPicker draft={crew} onChange={setCrew} />}
          {t.role === 'freelancer' && fstep === 2 && (
            <>
              <Text size={14} color={t.c.muted}>
                What organisers check before they hire a {crew.primarySkill.toLowerCase()}. Skip anything you’d rather add later.
              </Text>
              <CraftProfileForm draft={crew} onChange={setCrew} />
            </>
          )}
          {((t.role !== 'vendor' && t.role !== 'freelancer') || (t.role === 'vendor' && vstep === 4) || (t.role === 'freelancer' && fstep === 3)) && (
          <>
          <KField label={t.role === 'vendor' ? 'Owner / manager name' : 'Full name'} value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" error={errors.name} />
          {signInEmail ? (
            <KField label="Mobile number (optional, for your coordinator)" value={contactPhone} onChangeText={(v) => setContactPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" placeholder="98XXXXXXXX" error={errors.phone} />
          ) : (
            <KField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} />
          )}
          {/* Couples answer the wedding city in onboarding, right after this. */}
          {t.role !== 'customer' && (
            <View style={{ gap: 6 }}>
              <Text size={13} weight="semibold" color={t.c.muted}>
                Based in
              </Text>
              <ChoiceChips options={CITY_OPTIONS} selected={[city]} onToggle={(c) => { setCity(c); setClaimed(null); }} />
            </View>
          )}
          {t.role === 'customer' && (
            <Text size={13} color={t.c.muted}>
              Next, five quick questions about the wedding. It takes under a minute.
            </Text>
          )}

          {t.role === 'vendor' && (
            <>
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
              <KField label="PAN / VAT number (optional)" value={panVat} onChangeText={(v) => setPanVat(v.replace(/\D/g, '').slice(0, 9))} keyboardType="number-pad" placeholder="9-digit PAN" error={errors.pan} />
            </>
          )}

          {t.role === 'freelancer' && (
            <>
              <KField
                label={craft.rate === 'day' ? 'Day rate' : `Your usual rate ${RATE_LABEL[craft.rate]}`}
                value={dayRate}
                onChangeText={(v) => setDayRate(v.replace(/\D/g, ''))}
                keyboardType="number-pad"
                prefix="NPR"
                placeholder="8000"
                error={errors.rate}
              />
              <KField label="Short bio" value={bio} onChangeText={setBio} multiline placeholder={craft.equipment.length ? 'Experience, style, the kit you bring…' : 'Experience and the events you’ve worked…'} />
              <View style={{ gap: 6 }}>
                <Text size={13} weight="semibold" color={t.c.muted}>
                  How far will you travel?
                </Text>
                <ChoiceChips options={['10 km', '25 km', '50 km', '100 km', '200 km']} selected={[radius]} onToggle={setRadius} />
              </View>
            </>
          )}

          {t.role === 'platform' && (
            <>
              <View style={{ gap: 6 }}>
                <Text size={13} weight="semibold" color={t.c.muted}>
                  Team
                </Text>
                <ChoiceChips options={TEAMS.map((x) => x.team)} selected={[team]} onToggle={(v) => setTeam(v as PlatformTeam)} />
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
          </>
          )}
        </ScrollView>
        <View style={[styles.footer, { backgroundColor: t.c.surface, borderTopColor: t.c.border, paddingBottom: Math.max(insets.bottom, 14) }]}>
          {!!errors.form && (
            <Text size={13} color={t.c.danger} style={{ marginBottom: 8 }}>
              {errors.form}
            </Text>
          )}
          {t.role === 'freelancer' && fstep < 3 ? (
            <View style={styles.footerRow}>
              {fstep > 0 && <KButton label="Back" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setFstep((n) => n - 1)} />}
              <KButton label={fstep === 2 ? 'Continue to your details' : 'Continue'} size="lg" style={{ flex: 2 }} onPress={() => setFstep((n) => n + 1)} />
            </View>
          ) : t.role === 'vendor' && vstep < 4 ? (
            <View style={styles.footerRow}>
              {vstep > 0 && <KButton label="Back" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setVstep((n) => n - 1)} />}
              <KButton label={vstep === 3 ? 'Continue to your details' : 'Continue'} size="lg" style={{ flex: 2 }} onPress={() => setVstep((n) => n + 1)} />
            </View>
          ) : (
            <View style={styles.footerRow}>
              {t.role === 'vendor' && <KButton label="Back" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setVstep(3)} />}
              {t.role === 'freelancer' && <KButton label="Back" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setFstep(2)} />}
              <KButton label={t.role === 'customer' ? 'Continue' : 'Create account'} size="lg" style={{ flex: 2 }} loading={busy} onPress={submit} />
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

export default function SetupScreen() {
  const { phone, email } = useLocalSearchParams<{ phone?: string; email?: string }>();
  const role = useSession((s) => s.selectedRole) ?? 'customer';
  const fontsReady = useRoleFonts('all');
  if (!fontsReady) return null;
  return (
    <RoleThemeProvider role={role}>
      <SetupForm phone={phone ?? ''} signInEmail={email || undefined} />
    </RoleThemeProvider>
  );
}

const styles = StyleSheet.create({
  claim: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 8, alignItems: 'flex-start' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', gap: 10 },
});
