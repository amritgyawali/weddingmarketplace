import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { usesEmailSignIn } from '@/backend/auth';
import { updateMyProfile as saveOnServer } from '@/backend/account';
import { keepProfilePhoto } from '@/backend/contentMedia';
import { Avatar, Card, ChoiceChips, KButton, KField, KeyValue, SectionTitle, StackHeader } from '@/components/kit';
import { Calendar } from '@/components/ui/Calendar';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast, toastError } from '@/components/ui/Toast';
import { ONBOARDING_CITIES } from '@/data/cities';
import { supportHref } from '@/data/support';
import { useFormCheck } from '@/hooks/useFormCheck';
import { useLayout } from '@/hooks/useLayout';
import { isEmail, PROFILE_CITIES, PROFILE_LIMITS } from '@/services/profile';
import { useAppStore } from '@/store/useAppStore';
import { useAccount, useSession } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Role } from '@/types';
import type { Account } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatLongDate, formatPhone } from '@/utils/format';

const LANGUAGES = ['Nepali', 'English', 'Hindi', 'Newari', 'Maithili', 'Bhojpuri', 'Tamang', 'Gurung'];
const STAFF_ROLE_NAMES: Record<NonNullable<Account['staffRole']>, string> = {
  coordinator: 'Wedding coordinator',
  support: 'Support',
  finance: 'Finance',
  admin: 'Admin',
  super_admin: 'Super admin',
};
const COUPLE_ROLES: { id: Role; label: string }[] = [
  { id: 'bride', label: 'Bride' },
  { id: 'groom', label: 'Groom' },
  { id: 'other', label: 'Family or friend' },
];

/**
 * Edit profile, for every role: photo, name, email and city, plus the
 * couple's partner and date, a business's name and story, or a freelancer's
 * headline, story, experience and languages. Mobile number, role and
 * verification are changed by the Vivah team (a help request).
 */
export function EditProfileScreen() {
  const t = useRoleTheme();
  const account = useAccount();
  const { wide } = useLayout();
  const updateMyProfile = useSession((s) => s.updateMyProfile);
  const coupleProfile = useAppStore((s) => s.profile);
  const coupleRoleSaved = useAppStore((s) => s.role);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const updateCouple = useAppStore((s) => s.updateProfile);
  const setCoupleRole = useAppStore((s) => s.setRole);
  const setWeddingDate = useAppStore((s) => s.setWeddingDate);
  const live = usesEmailSignIn();
  const isCouple = account.role === 'customer';
  const isVendor = account.role === 'vendor';
  const isFreelancer = account.role === 'freelancer';

  const [photo, setPhoto] = useState<string | undefined>(account.photo);
  const [name, setName] = useState(account.name);
  const [email, setEmail] = useState(account.email ?? '');
  const [city, setCity] = useState(PROFILE_CITIES.includes(account.city) ? account.city : 'Kathmandu');
  const [business, setBusiness] = useState(account.businessName ?? '');
  const [headline, setHeadline] = useState(account.headline ?? '');
  const [bio, setBio] = useState(account.bio ?? '');
  const [years, setYears] = useState(account.experienceYears !== undefined ? String(account.experienceYears) : '');
  const [languages, setLanguages] = useState<string[]>(account.languages ?? []);
  const [partner, setPartner] = useState(coupleProfile.partnerName);
  const [coupleRole, setRole] = useState<Role | null>(coupleRoleSaved);
  const [date, setDate] = useState<string | null>(weddingDate);
  const [dateOpen, setDateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [busy, setBusy] = useState<'photo' | 'save' | null>(null);

  const check = useFormCheck({
    name: name.trim().length < PROFILE_LIMITS.nameMin && 'Enter your name',
    email: !!email.trim() && !isEmail(email.trim()) && 'Enter a valid email, like name@example.com',
    business: isVendor && business.trim().length < 2 && 'Enter your business name',
    years: isFreelancer && !!years.trim() && !(Number(years) >= 0 && Number(years) <= PROFILE_LIMITS.experienceMax) && 'Enter your years of experience (0 to 60)',
  });

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.5 });
    if (res.canceled || !res.assets[0]) return;
    setBusy('photo');
    const kept = await keepProfilePhoto(res.assets[0]);
    setBusy(null);
    if (!kept.ok) {
      toastError(kept.error);
      return;
    }
    setPhoto(kept.value);
  };

  const removePhoto = () => confirm('Remove your photo?', 'Your initials show instead.', 'Remove', () => setPhoto(undefined));

  const save = async () => {
    const patch = {
      name,
      email: live ? undefined : email,
      city,
      photo: photo ?? '',
      ...(isVendor ? { businessName: business, bio } : {}),
      ...(isFreelancer ? { headline, bio, experienceYears: years.trim() ? Number(years) : undefined, languages } : {}),
    };
    setBusy('save');
    if (live) {
      const server = await saveOnServer({ name: patch.name, city, photo: photo ?? null, businessName: isVendor ? business : undefined, headline: isFreelancer ? headline : undefined, bio: isVendor || isFreelancer ? bio : undefined });
      if (!server.ok) {
        setBusy(null);
        toastError(server.error);
        return;
      }
    }
    const error = updateMyProfile(Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
    setBusy(null);
    if (error) {
      toastError(error);
      return;
    }
    if (isCouple) {
      updateCouple({ name: name.trim(), email: live ? coupleProfile.email : email.trim(), partnerName: partner.trim() });
      if (coupleRole) setCoupleRole(coupleRole);
      setWeddingDate(date);
    }
    toast('Profile updated', 'checkmark-circle-outline');
    if (router.canGoBack()) router.back();
  };

  const askToChange = () => {
    router.push({ pathname: `${supportHref(account.role)}/new` as never, params: { topic: 'account' } } as Href);
    toast('Tell us the new number and we’ll change it for you', 'information-circle-outline', 'info');
  };

  const cityChips = [...new Set([...ONBOARDING_CITIES, city])];

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Edit profile" subtitle={ROLE_THEMES[account.role].label} />
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]} keyboardShouldPersistTaps="handled">
        <Card style={styles.photoCard}>
          <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel={photo ? 'Change photo' : 'Add a photo'} style={styles.photoWrap}>
            <Avatar name={name || account.name} size={88} photo={photo} />
            <View style={[styles.camera, { backgroundColor: t.c.primary, borderColor: t.c.surface }]}>
              <Ionicons name="camera" size={15} color={t.c.onPrimary} />
            </View>
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <Text serif size={19} weight="bold" color={t.c.textStrong} numberOfLines={1} raw>
              {name.trim() || account.name}
            </Text>
            <Text size={13} color={t.c.muted} numberOfLines={1} raw>
              {isVendor && business.trim() ? `${business.trim()} · ${city}` : city}
            </Text>
            <View style={styles.photoActions}>
              <KButton label={photo ? 'Change photo' : 'Add a photo'} size="sm" variant="secondary" icon="image-outline" loading={busy === 'photo'} onPress={pickPhoto} />
              {!!photo && <KButton label="Remove" size="sm" variant="ghost" onPress={removePhoto} />}
            </View>
          </View>
        </Card>

        <SectionTitle title="About you" />
        <Card style={{ gap: 14 }}>
          <KField label="Full name" value={name} onChangeText={setName} autoComplete="name" maxLength={PROFILE_LIMITS.nameMax} error={check.error('name')} required />
          {isCouple && <KField label="Partner’s name" value={partner} onChangeText={setPartner} placeholder="Your partner’s name" maxLength={PROFILE_LIMITS.nameMax} />}
          {isCouple && (
            <View style={{ gap: 8 }}>
              <Text size={13} weight="medium" color={t.c.text}>
                I am the
              </Text>
              <ChoiceChips options={COUPLE_ROLES.map((r) => r.label)} selected={COUPLE_ROLES.filter((r) => r.id === coupleRole).map((r) => r.label)} onToggle={(label) => setRole(COUPLE_ROLES.find((r) => r.label === label)?.id ?? null)} />
            </View>
          )}
          {isVendor && <KField label="Business name" value={business} onChangeText={setBusiness} maxLength={PROFILE_LIMITS.businessMax} error={check.error('business')} required />}
          {isFreelancer && <KField label="Headline" value={headline} onChangeText={setHeadline} placeholder="For example: Wedding photographer, 8 years, Kathmandu" maxLength={PROFILE_LIMITS.headlineMax} />}
          {(isVendor || isFreelancer) && (
            <KField
              label={isVendor ? 'About your business' : 'About you'}
              value={bio}
              onChangeText={setBio}
              placeholder={isVendor ? 'What you do, what makes you different, which areas you cover' : 'Your style, the weddings you love, what couples can expect'}
              multiline
              maxLength={PROFILE_LIMITS.bioMax}
            />
          )}
          {isFreelancer && <KField label="Years of experience" value={years} onChangeText={(v) => setYears(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="0" error={check.error('years')} />}
          {isFreelancer && (
            <View style={{ gap: 8 }}>
              <Text size={13} weight="medium" color={t.c.text}>
                Languages you speak
              </Text>
              <ChoiceChips options={LANGUAGES} selected={languages} onToggle={(l) => setLanguages((cur) => (cur.includes(l) ? cur.filter((x) => x !== l) : [...cur, l]))} />
            </View>
          )}
        </Card>

        <SectionTitle title="Where you are" />
        <Card style={{ gap: 10 }}>
          <ChoiceChips options={cityChips} selected={[city]} onToggle={setCity} />
          <KButton label="More cities" size="sm" variant="ghost" icon="location-outline" style={{ alignSelf: 'flex-start' }} onPress={() => setCityOpen(true)} />
        </Card>

        {isCouple && (
          <>
            <SectionTitle title="Your celebration" />
            <Card padded={false}>
              <Pressable onPress={() => setDateOpen(true)} accessibilityRole="button" style={({ pressed }) => [styles.dateRow, pressed && { backgroundColor: t.c.surfaceAlt }]}>
                <Ionicons name="calendar-outline" size={20} color={t.c.primary} />
                <View style={{ flex: 1 }}>
                  <Text size={13} color={t.c.muted}>
                    Main date
                  </Text>
                  <Text size={15} weight="semibold" color={date ? t.c.textStrong : t.c.muted}>
                    {date ? formatLongDate(date) : 'Add your date'}
                  </Text>
                </View>
                {date && (
                  <Pressable onPress={() => setDate(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear date">
                    <Ionicons name="close-circle" size={20} color={t.c.subtle} />
                  </Pressable>
                )}
              </Pressable>
            </Card>
          </>
        )}

        <SectionTitle title="Contact and sign-in" />
        <Card style={{ gap: 14 }}>
          {live ? (
            <KeyValue label="Email (sign-in)" value={account.email ?? '—'} />
          ) : (
            <KField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="you@example.com" error={check.error('email')} hint="For receipts and quotations. Optional." />
          )}
          <View style={styles.lockedRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text size={13} color={t.c.muted}>
                Mobile number
              </Text>
              <Text size={15} weight="semibold" color={t.c.textStrong} raw>
                {account.phone ? formatPhone(account.phone) : '—'}
              </Text>
            </View>
            <KButton label="Change" size="sm" variant="ghost" onPress={askToChange} />
          </View>
          {account.role === 'platform' && (
            <KeyValue label="Role" value={[account.staffRole ? STAFF_ROLE_NAMES[account.staffRole] : 'Staff', account.team].filter(Boolean).join(' · ')} />
          )}
          <Text size={12} color={t.c.muted}>
            {live ? 'You sign in with your email and number, so the Vivah team changes them for you after a quick check.' : 'You sign in with your number, so the Vivah team changes it for you after a quick check.'}
          </Text>
        </Card>

        <KButton label="Save changes" size="lg" icon="checkmark" loading={busy === 'save'} disabled={busy === 'photo'} missing={check.missing} onMissing={check.reveal} onPress={save} />
      </ScrollView>

      <Sheet visible={dateOpen} onClose={() => setDateOpen(false)} title="Main date">
        <View style={{ paddingHorizontal: 20, gap: 16 }}>
          <Calendar value={date} onChange={setDate} />
          <KButton label="Done" onPress={() => setDateOpen(false)} />
        </View>
      </Sheet>
      <Sheet visible={cityOpen} onClose={() => setCityOpen(false)} title="Your city">
        <View style={{ paddingHorizontal: 20, paddingBottom: 12 }}>
          <ChoiceChips
            options={PROFILE_CITIES}
            selected={[city]}
            onToggle={(c) => {
              setCity(c);
              setCityOpen(false);
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 60 },
  bodyWide: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingTop: 24 },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  photoWrap: { width: 88, height: 88 },
  camera: { position: 'absolute', right: -2, bottom: -2, width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  photoActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
