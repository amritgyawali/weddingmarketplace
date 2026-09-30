import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, ChoiceChips, KButton, KField, StackHeader } from '@/components/kit';
import { draftForTrade, EssentialsForm, FormPicker, ServicePicker, TradeTiles, type VendorPersonaDraft } from '@/components/persona/VendorPersona';
import { Text } from '@/components/ui/Text';
import { categoryForService } from '@/data/categories';
import { ONBOARDING_CITIES } from '@/data/cities';
import { PLATFORM_ACCESS_CODE } from '@/data/seed';
import { FREELANCE_SKILLS } from '@/data/skills';
import { VENDORS } from '@/data/vendors';
import { VENUES } from '@/data/venues';
import { completeLogin, onAccountCreated } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';
import { formatPhone } from '@/utils/format';
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

function SetupForm({ phone }: { phone: string }) {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const register = useSession((s) => s.register);
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
  // freelancer
  const [skills, setSkills] = useState<string[]>([]);
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

  const submit = () => {
    const next: Record<string, string | null> = {
      name: name.trim().length < 2 ? 'Enter your full name' : null,
      email: email && !/^\S+@\S+\.\S+$/.test(email) ? 'Enter a valid email' : null,
      business: t.role === 'vendor' && !claimed && businessName.trim().length < 3 ? 'Enter your business name or claim a listing' : null,
      skills: t.role === 'freelancer' && !skills.length ? 'Pick at least one skill' : null,
      rate: t.role === 'freelancer' && !(Number(dayRate) > 0) ? 'Enter your day rate' : null,
      pan: t.role === 'vendor' && panVat && !/^\d{9}$/.test(panVat) ? 'PAN/VAT numbers have 9 digits' : null,
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
          ? { skills, dayRate: Number(dayRate), bio: bio.trim(), available: true, rating: 5, travelRadiusKm: Number(radius.replace(/\D/g, '')), languages: ['Nepali'] }
          : t.role === 'platform'
            ? { team, staffRole: TEAMS.find((x) => x.team === team)!.role }
            : {};
    const account = register({ ...base, ...extra });
    onAccountCreated(account);
    completeLogin(account);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader
        title={t.role === 'customer' ? 'What should we call you?' : t.role === 'vendor' ? VENDOR_STEPS[vstep] : 'Create your account'}
        subtitle={t.role === 'vendor' ? `Step ${vstep + 1} of ${VENDOR_STEPS.length} · ${formatPhone(phone)}` : `${t.label} · ${formatPhone(phone)}`}
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
          {(t.role !== 'vendor' || vstep === 4) && (
          <>
          <KField label={t.role === 'vendor' ? 'Owner / manager name' : 'Full name'} value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" error={errors.name} />
          <KField label="Email (optional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" error={errors.email} />
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
          {t.role === 'vendor' && vstep < 4 ? (
            <View style={styles.footerRow}>
              {vstep > 0 && <KButton label="Back" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setVstep((n) => n - 1)} />}
              <KButton label={vstep === 3 ? 'Continue to your details' : 'Continue'} size="lg" style={{ flex: 2 }} onPress={() => setVstep((n) => n + 1)} />
            </View>
          ) : (
            <View style={styles.footerRow}>
              {t.role === 'vendor' && <KButton label="Back" variant="secondary" size="lg" style={{ flex: 1 }} onPress={() => setVstep(3)} />}
              <KButton label={t.role === 'customer' ? 'Continue' : 'Create account'} size="lg" style={{ flex: 2 }} onPress={submit} />
            </View>
          )}
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
  claim: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderRadius: 8, padding: 10 },
  note: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 8, alignItems: 'flex-start' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerRow: { flexDirection: 'row', gap: 10 },
});
