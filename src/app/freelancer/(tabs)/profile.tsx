import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, ChoiceChips, KButton, KField, ListRow, ProgressBar, SectionTitle, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { photos } from '@/constants/images';
import { craftProfileLines } from '@/components/persona/FreelancerPersona';
import { CRAFT_BY_ID, CRAFTS } from '@/data/crafts';
import { reliabilityScore } from '@/data/freelancers';
import { useExperience } from '@/hooks/useExperience';
import { myApplication, useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { logout } from '@/services/auth';
import { useDb, useUnreadMessageCount } from '@/store/useDb';
import { useAccount, useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Equipment } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatMoney, formatPhone, formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const LANGUAGES = ['Nepali', 'English', 'Hindi', 'Newari', 'Maithili', 'Bhojpuri', 'Tamang', 'Gurung', 'Tharu', 'Magar'];
const RADII = [10, 25, 50, 100, 200];
const EQUIPMENT_KINDS: { id: Equipment['kind']; label: string }[] = [
  { id: 'camera', label: 'Camera' },
  { id: 'lens', label: 'Lens' },
  { id: 'flash', label: 'Flash' },
  { id: 'drone', label: 'Drone' },
  { id: 'gimbal', label: 'Gimbal' },
  { id: 'light', label: 'Lighting' },
  { id: 'audio', label: 'Audio' },
  { id: 'kit', label: 'Kit' },
  { id: 'vehicle', label: 'Vehicle' },
  { id: 'other', label: 'Other' },
];
const KIND_ICON: Record<Equipment['kind'], keyof typeof Ionicons.glyphMap> = {
  camera: 'camera',
  lens: 'aperture',
  flash: 'flash',
  drone: 'airplane',
  gimbal: 'videocam',
  light: 'bulb',
  audio: 'mic',
  kit: 'briefcase',
  vehicle: 'car',
  other: 'cube',
};

/** Crew profile: skills, kit, rates, travel, languages, reliability, reviews and portfolio. */
export default function FreelancerProfile() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const updateAccount = useSession((s) => s.updateAccount);
  const setPersona = useDb((s) => s.setFreelancerPersona);
  const exp = useExperience();
  const craft = exp.craft ? CRAFT_BY_ID[exp.craft] : undefined;
  const verification = useDb((s) => s.verifications.find((v) => v.subjectId === account.id));
  const portfolio = useDb((s) => s.portfolio);
  const unread = useUnreadMessageCount(account);
  const { payables, assignments, standalone, reviews } = useFreelancerWorkspace(account);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ headline: '', bio: '', dayRate: '', hourlyRate: '', eventRate: '', experienceYears: '' });
  const [kitOpen, setKitOpen] = useState(false);
  const [kitKind, setKitKind] = useState<Equipment['kind']>('camera');
  const [kitName, setKitName] = useState('');

  const mine = assignments.map((x) => x.assignment);
  const completed = mine.filter((a) => a.status === 'COMPLETED').length + standalone.filter((g) => myApplication(g, account.id)?.status === 'completed').length;
  const released = mine.filter((a) => a.status === 'EMERGENCY_REPLACEMENT').length;
  const noShows = mine.filter((a) => a.status === 'NO_SHOW').length;
  const late = mine.filter((a) => (a.lateMinutes ?? 0) > 10).length;
  const total = Math.max(1, mine.length);
  const rating = reviews.length ? reviews.reduce((s, r) => s + r.overall, 0) / reviews.length : account.rating ?? 4.8;
  const reliability = reliabilityScore({ cancellationRate: released / total, rating, responseRate: 0.96, completed: completed + 12, lateArrivals: late, noShows });
  const earned = payables.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const work = portfolio.filter((p) => p.providerId === account.id).sort((a, b) => a.order - b.order);
  const status = verification?.status ?? (account.verified ? 'VERIFIED' : 'UNVERIFIED');
  const kinds = EQUIPMENT_KINDS.filter((k) => !exp.equipmentKinds.length || exp.equipmentKinds.includes(k.id));
  const hasKit = exp.equipmentKinds.length > 0 || (account.equipment ?? []).length > 0;
  const profileLines = craft ? craftProfileLines(craft.id, account.tradeProfile) : [];
  // Skills worth offering as chips: the crafts they already work in, plus their neighbours.
  const skillOptions = [...new Set([...exp.crafts.flatMap((c) => [...CRAFT_BY_ID[c].skills, ...CRAFT_BY_ID[c].neighbours]), ...(account.skills ?? [])])];
  const checklist = [
    { done: (account.skills ?? []).length > 0, label: 'Skills' },
    { done: !!account.bio, label: 'Bio' },
    ...(craft ? [{ done: profileLines.length > 0, label: `${craft.label} profile` }] : []),
    ...(hasKit ? [{ done: (account.equipment ?? []).length > 0, label: 'Equipment' }] : []),
    { done: work.length >= 6, label: '6+ portfolio items' },
    { done: status === 'VERIFIED', label: 'Verified ID' },
    { done: !!account.payoutMethod, label: 'Payout method' },
  ];
  const strength = checklist.filter((c) => c.done).length / checklist.length;

  const startEdit = () => {
    setDraft({
      headline: account.headline ?? '',
      bio: account.bio ?? '',
      dayRate: String(account.dayRate ?? ''),
      hourlyRate: String(account.hourlyRate ?? ''),
      eventRate: String(account.eventRate ?? ''),
      experienceYears: String(account.experienceYears ?? ''),
    });
    setEditing(true);
  };
  const num = (v: string) => v.replace(/\D/g, '');
  const save = () => {
    updateAccount(account.id, {
      headline: draft.headline.trim() || undefined,
      bio: draft.bio.trim(),
      dayRate: Number(draft.dayRate) || account.dayRate,
      hourlyRate: Number(draft.hourlyRate) || undefined,
      eventRate: Number(draft.eventRate) || undefined,
      experienceYears: Number(draft.experienceYears) || undefined,
    });
    setEditing(false);
    toast('Profile updated');
  };
  const toggleSkill = (s: string) => {
    const skills = account.skills ?? [];
    const next = skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s];
    if (!next.length) return toast('Keep at least one skill');
    const primary = account.primarySkill && next.includes(account.primarySkill) ? account.primarySkill : next[0];
    const problem = setPersona(account.id, { skills: next, primarySkill: primary });
    if (problem) toast(problem);
  };
  const openKit = () => {
    if (!kinds.some((k) => k.id === kitKind)) setKitKind(kinds[0]?.id ?? 'other');
    setKitOpen(true);
  };
  const toggleLanguage = (l: string) => {
    const langs = account.languages ?? ['Nepali'];
    updateAccount(account.id, { languages: langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l] });
  };
  const removeKit = (i: number) => updateAccount(account.id, { equipment: (account.equipment ?? []).filter((_, j) => j !== i) });

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 16, gap: 16, paddingBottom: 32 }}>
      <View style={styles.headerRow}>
        <Avatar name={account.name} size={64} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={21} weight="bold" color={t.c.textStrong}>
            {account.name}
          </Text>
          <Text size={14} color={t.c.muted}>
            {account.headline || (account.skills ?? []).join(' · ')} · {account.city}
          </Text>
          <View style={styles.row}>
            <StatusPill status={status} label={status === 'VERIFIED' ? 'Verified' : status === 'UNDER_REVIEW' ? 'Verification in review' : 'Not verified'} />
            <Ionicons name="star" size={13} color="#C8A46B" />
            <Text size={13} weight="medium" color={t.c.textStrong}>
              {rating.toFixed(1)} ({reviews.length})
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        {[
          { label: 'Jobs done', value: String(completed) },
          { label: 'Reliability', value: `${reliability}` },
          { label: 'Earned', value: formatMoney(earned).replace('NPR ', '') },
        ].map((s) => (
          <Card key={s.label} style={styles.stat}>
            <Text size={19} weight="semibold" color={t.c.textStrong}>
              {s.value}
            </Text>
            <Text size={12} color={t.c.muted}>
              {s.label}
            </Text>
          </Card>
        ))}
      </View>

      <Card style={{ gap: 10 }}>
        <View style={styles.between}>
          <Text size={15} weight="bold" color={t.c.textStrong}>
            Profile strength
          </Text>
          <Text size={13} weight="semibold" color={t.c.textStrong}>
            {Math.round(strength * 100)}%
          </Text>
        </View>
        <ProgressBar value={strength} />
        <View style={styles.wrap}>
          {checklist.map((c) => (
            <View key={c.label} style={styles.check}>
              <Ionicons name={c.done ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={c.done ? t.c.success : t.c.muted} />
              <Text size={12} color={c.done ? t.c.text : t.c.muted}>
                {c.label}
              </Text>
            </View>
          ))}
        </View>
        <Text size={12} color={t.c.muted}>
          Reliability counts on-time arrivals, completed jobs and releases. {released ? `${released} release(s) and ` : ''}{late ? `${late} late arrival(s) ` : ''}{released || late ? 'are lowering it.' : 'Keep it up — top crew get emergency invites first.'}
        </Text>
      </Card>

      <Card style={styles.between}>
        <View style={{ flex: 1 }}>
          <Text size={16} weight="bold" color={t.c.textStrong}>
            Available for gigs
          </Text>
          <Text size={12} color={t.c.muted}>
            Organisers can find and invite you when this is on
          </Text>
        </View>
        <Toggle value={account.available ?? true} onValueChange={(v) => updateAccount(account.id, { available: v })} accessibilityLabel="Available for gigs" />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title="About & rates" action={editing ? undefined : 'Edit'} onAction={startEdit} />
        {editing ? (
          <>
            <KField label="Headline" value={draft.headline} onChangeText={(v) => setDraft((d) => ({ ...d, headline: v }))} placeholder="Candid wedding photographer — 6 yrs" />
            <KField label="Bio" value={draft.bio} onChangeText={(v) => setDraft((d) => ({ ...d, bio: v }))} multiline />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <KField label="Day rate" value={draft.dayRate} onChangeText={(v) => setDraft((d) => ({ ...d, dayRate: num(v) }))} keyboardType="number-pad" prefix="NPR" />
              </View>
              <View style={{ flex: 1 }}>
                <KField label="Per event" value={draft.eventRate} onChangeText={(v) => setDraft((d) => ({ ...d, eventRate: num(v) }))} keyboardType="number-pad" prefix="NPR" />
              </View>
            </View>
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <KField label="Hourly" value={draft.hourlyRate} onChangeText={(v) => setDraft((d) => ({ ...d, hourlyRate: num(v) }))} keyboardType="number-pad" prefix="NPR" />
              </View>
              <View style={{ flex: 1 }}>
                <KField label="Years of experience" value={draft.experienceYears} onChangeText={(v) => setDraft((d) => ({ ...d, experienceYears: num(v) }))} keyboardType="number-pad" />
              </View>
            </View>
            <View style={styles.row}>
              <KButton label="Cancel" variant="ghost" size="sm" style={{ flex: 1 }} onPress={() => setEditing(false)} />
              <KButton label="Save" size="sm" style={{ flex: 1 }} onPress={save} />
            </View>
          </>
        ) : (
          <>
            <Text size={14} color={t.c.text} lineHeight={21}>
              {account.bio || 'Tell organisers about your experience, style and the weddings you’ve worked.'}
            </Text>
            <View style={styles.wrap}>
              {[
                exp.rateModel === 'package' ? `${formatMoney(account.dayRate ?? 0)} per project` : exp.rateModel === 'event' && account.eventRate ? `${formatMoney(account.eventRate)}/event` : `${formatMoney(account.dayRate ?? 0)}/day`,
                exp.rateModel === 'event' && account.eventRate ? `${formatMoney(account.dayRate ?? 0)}/day` : exp.rateModel !== 'event' && account.eventRate ? `${formatMoney(account.eventRate)}/event` : null,
                account.hourlyRate ? `${formatMoney(account.hourlyRate)}/hr` : null,
                account.experienceYears ? `${account.experienceYears} yrs experience` : null,
              ]
                .filter(Boolean)
                .map((x) => (
                  <View key={x} style={[styles.tag, { borderWidth: 1, borderColor: t.c.border }]}>
                    <Text size={12} weight="medium" color={t.c.text}>
                      {x}
                    </Text>
                  </View>
                ))}
            </View>
          </>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title={craft ? `Your craft · ${craft.label}` : 'Your craft'} action="Edit" onAction={() => router.push('/freelancer/craft')} />
        {!account.primarySkill && (
          <Text size={13} color={t.c.warning}>
            Pick your main skill so organisers see the right profile.
          </Text>
        )}
        {profileLines.length === 0 ? (
          <Text size={13} color={t.c.muted}>
            {craft ? `Answer a few ${craft.label.toLowerCase()} questions organisers check before hiring.` : 'Tell organisers what you do.'}
          </Text>
        ) : (
          profileLines.map((l) => (
            <View key={l.label} style={styles.between}>
              <Text size={13} color={t.c.muted} style={{ flex: 1 }}>
                {l.label}
              </Text>
              <Text size={13} weight="medium" color={t.c.textStrong} style={{ flex: 1, textAlign: 'right' }}>
                {l.value}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title="Skills" action={skillOptions.length < CRAFTS.flatMap((c) => c.skills).length ? 'All skills' : undefined} onAction={() => router.push('/freelancer/craft')} />
        <ChoiceChips options={skillOptions} selected={account.skills ?? []} onToggle={toggleSkill} />
        <Text size={12} color={t.c.muted}>
          You see gigs for these skills only. {account.primarySkill ? `${account.primarySkill} is your main skill.` : ''}
        </Text>
      </Card>

      {hasKit && (
      <Card style={{ gap: 12 }}>
        <SectionTitle title="Equipment" action={exp.equipmentKinds.length ? 'Add' : undefined} onAction={openKit} />
        {(account.equipment ?? []).length === 0 ? (
          <Text size={13} color={t.c.muted}>
            Organisers filter by kit. {craft?.kitHint ? `List what you bring, ${craft.kitHint.replace(/^e\.g\. /, 'like ')}.` : 'List what you bring to a job.'}
          </Text>
        ) : (
          (account.equipment ?? []).map((e, i) => (
            <View key={`${e.name}-${i}`} style={styles.row}>
              <Ionicons name={KIND_ICON[e.kind]} size={18} color={t.c.primary} />
              <Text size={14} color={t.c.text} style={{ flex: 1 }}>
                {e.name}
              </Text>
              <Pressable onPress={() => removeKit(i)} accessibilityLabel={`Remove ${e.name}`} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={t.c.muted} />
              </Pressable>
            </View>
          ))
        )}
      </Card>
      )}

      <Card style={{ gap: 12 }}>
        <SectionTitle title="Travel & languages" />
        <View style={styles.between}>
          <Text size={14} color={t.c.text}>
            I have my own vehicle
          </Text>
          <Toggle value={account.ownVehicle ?? false} onValueChange={(v) => updateAccount(account.id, { ownVehicle: v })} accessibilityLabel="Own vehicle" />
        </View>
        <Text size={13} color={t.c.muted}>
          I’ll travel up to
        </Text>
        <ChoiceChips options={RADII.map((r) => `${r} km`)} selected={[`${account.travelRadiusKm ?? 25} km`]} onToggle={(v) => updateAccount(account.id, { travelRadiusKm: Number(v.replace(/\D/g, '')) })} />
        <Text size={13} color={t.c.muted}>
          Languages
        </Text>
        <ChoiceChips options={LANGUAGES} selected={account.languages ?? ['Nepali']} onToggle={toggleLanguage} />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title="Portfolio" action="Manage" onAction={() => router.push('/freelancer/portfolio')} />
        {work.length === 0 ? (
          <KButton label="Add your best work" icon="images-outline" variant="secondary" onPress={() => router.push('/freelancer/portfolio')} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {work.slice(0, 10).map((p) => (
              <Image key={p.id} source={p.uri ? { uri: p.uri } : photos[p.image!]} style={styles.thumb} contentFit="cover" />
            ))}
          </ScrollView>
        )}
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title={`Reviews (${reviews.length})`} />
        {reviews.length === 0 ? (
          <Text size={13} color={t.c.muted}>
            Organisers review you after each completed job.
          </Text>
        ) : (
          reviews.slice(0, 5).map((r) => (
            <View key={r.id} style={{ gap: 4 }}>
              <View style={styles.row}>
                <Ionicons name="star" size={13} color={t.c.primary} />
                <Text size={13} weight="bold" color={t.c.textStrong}>
                  {r.overall.toFixed(1)}
                </Text>
                <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                  {r.authorName} · {formatShortDate(r.at)}
                </Text>
              </View>
              <Text size={13} color={t.c.text} lineHeight={19}>
                {r.text}
              </Text>
              <Text size={11} color={t.c.muted}>
                {Object.entries(r.criteria)
                  .map(([k, v]) => `${k} ${v}`)
                  .join(' · ')}
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <ListRow icon="briefcase-outline" title="Your craft" subtitle={account.primarySkill ? `${(account.skills ?? []).join(', ')}` : 'Pick your main skill'} onPress={() => router.push('/freelancer/craft')} />
        <ListRow icon="construct-outline" title="Freelancer tools" subtitle="Tax, invoices, travel and more for your craft" onPress={() => router.push('/freelancer/tools')} />
        <ListRow icon="chatbubbles-outline" title="Messages" subtitle={unread ? `${unread} unread` : 'Organiser and team chats'} onPress={() => router.push('/freelancer/inbox')} />
        <ListRow icon="shield-checkmark-outline" title="Verification" subtitle={status === 'VERIFIED' ? `Verified${verification?.expiresAt ? ` · renews ${formatShortDate(verification.expiresAt)}` : ''}` : 'Upload citizenship & portfolio'} onPress={() => router.push('/freelancer/verification')} />
        <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
        <ListRow icon="settings-outline" title="Settings" subtitle="Notifications, language, privacy" onPress={() => router.push('/freelancer/settings')} />
        <ListRow icon="call-outline" title="Phone" subtitle={formatPhone(account.phone)} />
      </Card>

      <KButton label="Log out" variant="danger" icon="log-out-outline" onPress={() => confirm('Log out?', 'You can sign back in with your mobile number.', 'Log out', logout)} />

      <Sheet visible={kitOpen} onClose={() => setKitOpen(false)} title="Add equipment">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <ChoiceChips options={kinds.map((k) => k.label)} selected={kinds.filter((k) => k.id === kitKind).map((k) => k.label)} onToggle={(v) => setKitKind(kinds.find((k) => k.label === v)!.id)} />
          <KField label="Model" value={kitName} onChangeText={setKitName} placeholder={craft?.kitHint ?? 'e.g. Sony A7 IV, 24-70mm f/2.8 GM'} />
          <KButton
            label="Add"
            disabled={!kitName.trim()}
            onPress={() => {
              updateAccount(account.id, { equipment: [...(account.equipment ?? []), { kind: kitKind, name: kitName.trim() }] });
              setKitName('');
              setKitOpen(false);
              toast('Equipment added');
            }}
          />
        </View>
      </Sheet>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, gap: 0, paddingVertical: 10, paddingHorizontal: 12 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  tag: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  thumb: { width: 96, height: 96, borderRadius: 8 },
});
