import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar, Card, ChoiceChips, KButton, KField, ListRow, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { FREELANCE_SKILLS } from '@/data/skills';
import { useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { logout } from '@/services/auth';
import { useAccount, useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';

export default function FreelancerProfile() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const updateAccount = useSession((s) => s.updateAccount);
  const { payouts, applied } = useFreelancerWorkspace(account);
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState(String(account.dayRate ?? ''));
  const [bio, setBio] = useState(account.bio ?? '');

  const jobsDone = applied.filter((g) => g.applications.some((a) => a.freelancerId === account.id && a.status === 'completed')).length;
  const earned = payouts.filter((p) => p.status === 'paid').reduce((s, p) => s + p.amount, 0);

  const toggleSkill = (s: string) => {
    const skills = account.skills ?? [];
    const next = skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s];
    if (next.length) updateAccount(account.id, { skills: next });
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 16, gap: 16, paddingBottom: 130 }}>
      <View style={styles.center}>
        <Avatar name={account.name} size={84} />
        <Text size={24} weight="bold" color={t.c.textStrong} style={{ marginTop: 10 }}>
          {account.name}
        </Text>
        <Text size={14} color={t.c.muted}>
          {(account.skills ?? []).join(' · ')} · {account.city}
        </Text>
        <View style={styles.row}>
          <StatusPill status={account.verified ? 'approved' : 'pending'} label={account.verified ? 'Verified pro' : 'Verification pending'} />
          <View style={styles.row}>
            <Ionicons name="star" size={14} color={t.c.primary} />
            <Text size={14} weight="bold" color={t.c.textStrong}>
              {(account.rating ?? 5).toFixed(1)}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.stats}>
        {[
          { label: 'Jobs done', value: String(jobsDone) },
          { label: 'Earned', value: `₹${Math.round(earned / 1000)}K` },
          { label: 'Day rate', value: `₹${((account.dayRate ?? 0) / 1000).toFixed(1)}K` },
        ].map((s) => (
          <Card key={s.label} style={styles.stat}>
            <Text size={20} weight="bold" color={t.c.primary}>
              {s.value}
            </Text>
            <Text size={12} color={t.c.muted}>
              {s.label}
            </Text>
          </Card>
        ))}
      </View>

      <Card style={styles.availability}>
        <View style={{ flex: 1 }}>
          <Text size={16} weight="bold" color={t.c.textStrong}>
            Available for gigs
          </Text>
          <Text size={12} color={t.c.muted}>
            Vendors can find and invite you when this is on
          </Text>
        </View>
        <Toggle value={account.available ?? true} onValueChange={(v) => updateAccount(account.id, { available: v })} accessibilityLabel="Available for gigs" />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title="Skills" />
        <ChoiceChips options={[...FREELANCE_SKILLS]} selected={account.skills ?? []} onToggle={toggleSkill} />
      </Card>

      <Card style={{ gap: 12 }}>
        <SectionTitle title="About & rate" action={editing ? undefined : 'Edit'} onAction={() => setEditing(true)} />
        {editing ? (
          <>
            <KField label="Day rate" value={rate} onChangeText={(v) => setRate(v.replace(/\D/g, ''))} keyboardType="number-pad" prefix="NPR" />
            <KField label="Bio" value={bio} onChangeText={setBio} multiline />
            <KButton
              label="Save"
              size="sm"
              onPress={() => {
                updateAccount(account.id, { dayRate: Number(rate) || account.dayRate, bio: bio.trim() });
                setEditing(false);
                toast('Profile updated');
              }}
            />
          </>
        ) : (
          <Text size={14} color={t.c.text} lineHeight={21}>
            {account.bio || 'Tell vendors about your experience, style and equipment.'}
          </Text>
        )}
      </Card>

      <Card padded={false} style={{ overflow: 'hidden' }}>
        <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
        <ListRow icon="call-outline" title="Phone" subtitle={`+977 ${account.phone}`} />
        <ListRow icon="shield-checkmark-outline" title="KYC & payouts" subtitle="Bank account linked · weekly payouts" />
      </Card>

      <KButton
        label="Log out"
        variant="danger"
        icon="log-out-outline"
        onPress={() =>
          confirm('Log out?', 'You can sign back in with your mobile number.', 'Log out', logout)
        }
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 2, padding: 14 },
  availability: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
