import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyBlock, SectionTitle } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { GigCard } from '@/components/work/GigCard';
import { cityDistanceKm } from '@/data/cities';
import { FREELANCE_SKILLS } from '@/data/skills';
import { useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatClock, formatMoney, formatMoneyCompact } from '@/utils/format';

type Sort = 'match' | 'pay' | 'date' | 'distance';

/** Gig marketplace for crew: invitations, emergencies and skill-matched gigs nearby. */
export default function DiscoverGigs() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { open, invited, upcoming, payables } = useFreelancerWorkspace(account);
  const unread = useInbox(account).filter((n) => !n.read).length;
  const mySkills = account.skills ?? [];
  const radius = account.travelRadiusKm ?? 25;
  const [skill, setSkill] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [sort, setSort] = useState<Sort>('match');

  const km = (city: string) => cityDistanceKm(account.city, city);
  const emergencies = open.filter((g) => g.emergency && mySkills.includes(g.skill));
  const feed = open
    .filter((g) => !g.emergency || !mySkills.includes(g.skill))
    .filter((g) => (!skill || g.skill === skill) && (!nearMe || (km(g.city) ?? 999) <= radius))
    .sort((a, b) =>
      sort === 'pay'
        ? b.pay - a.pay
        : sort === 'date'
          ? a.date.localeCompare(b.date)
          : sort === 'distance'
            ? (km(a.city) ?? 999) - (km(b.city) ?? 999)
            : Number(mySkills.includes(b.skill)) - Number(mySkills.includes(a.skill)) || (km(a.city) ?? 999) - (km(b.city) ?? 999),
    );
  const today = upcoming.find((x) => daysUntil(x.assignment.date) === 0);
  const month = payables.filter((p) => p.status === 'PAID' && new Date(p.paidAt ?? p.due).getMonth() === new Date().getMonth()).reduce((s, p) => s + p.amount, 0);
  const skillOrder = [...mySkills, ...FREELANCE_SKILLS.filter((s) => !mySkills.includes(s))];

  const header = (
    <View style={{ gap: 18, paddingBottom: 6 }}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text size={14} color={t.c.muted}>
            Namaste {account.name.split(' ')[0]} 👋
          </Text>
          <Text size={28} weight="bold" color={t.c.textStrong} lineHeight={34}>
            Find your next{'\n'}wedding gig
          </Text>
        </View>
        <Pressable onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" style={[styles.bell, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
          <Ionicons name="notifications-outline" size={21} color={t.c.textStrong} />
          {unread > 0 && <View style={[styles.dot, { backgroundColor: t.c.primary }]} />}
        </Pressable>
      </View>

      {today && (
        <Pressable onPress={() => router.push({ pathname: '/freelancer/assignment/[id]', params: { id: today.assignment.id } })} accessibilityRole="button" style={{ marginHorizontal: 16 }}>
          <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.today}>
            <View style={{ flex: 1 }}>
              <Text size={12} weight="bold" color={t.c.onPrimary} tracking={1}>
                ● YOU’RE WORKING TODAY
              </Text>
              <Text size={17} weight="bold" color={t.c.onPrimary} numberOfLines={1}>
                {today.assignment.role} · {today.project.title}
              </Text>
              <Text size={13} color={t.c.onPrimary}>
                {formatClock(today.assignment.startTime)} · {today.project.events.find((e) => e.id === today.assignment.eventId)?.venue ?? today.project.city} · {today.assignment.status === 'CHECKED_IN' ? 'checked in' : 'tap to check in'}
              </Text>
            </View>
            <View style={[styles.go, { backgroundColor: t.c.onPrimary }]}>
              <Ionicons name="location" size={20} color={t.c.primary} />
            </View>
          </LinearGradient>
        </Pressable>
      )}

      {emergencies.length > 0 && (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SectionTitle title="🚨 Emergency — needed now" />
          {emergencies.map((g) => (
            <GigCard key={g.id} gig={g} distance={km(g.city)} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: g.id } })} />
          ))}
        </View>
      )}

      {invited.filter((g) => !g.emergency).length > 0 && (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SectionTitle title="You’re invited" />
          {invited
            .filter((g) => !g.emergency)
            .map((g) => (
              <GigCard key={g.id} gig={g} badge="invited" distance={km(g.city)} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: g.id } })} />
            ))}
        </View>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
          <Text size={22} weight="bold" color={t.c.primary}>
            {open.filter((g) => mySkills.includes(g.skill)).length}
          </Text>
          <Text size={12} color={t.c.muted}>
            match your skills
          </Text>
        </View>
        <View style={[styles.stat, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
          <Text size={22} weight="bold" color={t.c.textStrong}>
            {upcoming.length}
          </Text>
          <Text size={12} color={t.c.muted}>
            jobs booked
          </Text>
        </View>
        <View style={[styles.stat, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
          <Text size={18} weight="bold" color={t.c.textStrong}>
            {formatMoneyCompact(month).replace('NPR ', '')}
          </Text>
          <Text size={12} color={t.c.muted}>
            paid this month
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Pressable onPress={() => { triggerHaptic('selection'); setNearMe((v) => !v); }} style={[styles.filter, { borderColor: nearMe ? t.c.primary : t.c.border, backgroundColor: nearMe ? t.c.primary : t.c.surface }]}>
          <Ionicons name="location" size={14} color={nearMe ? t.c.onPrimary : t.c.muted} />
          <Text size={13} weight="semibold" color={nearMe ? t.c.onPrimary : t.c.text}>
            Within {radius} km
          </Text>
        </Pressable>
        {(['match', 'pay', 'date', 'distance'] as Sort[]).map((s) => (
          <Pressable key={s} onPress={() => setSort(s)} style={[styles.filter, { borderColor: sort === s ? t.c.primary : t.c.border, backgroundColor: t.c.surface }]}>
            <Text size={13} weight="semibold" color={sort === s ? t.c.primary : t.c.text}>
              {s === 'match' ? 'Best match' : s === 'pay' ? 'Highest pay' : s === 'date' ? 'Soonest' : 'Nearest'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {skillOrder.map((s) => {
          const on = skill === s;
          return (
            <Pressable key={s} onPress={() => { triggerHaptic('selection'); setSkill(on ? null : s); }} style={[styles.filter, { borderColor: on ? t.c.primary : t.c.border, backgroundColor: on ? t.c.primary : t.c.surface }]}>
              <Text size={13} weight="semibold" color={on ? t.c.onPrimary : t.c.text}>
                {s}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: 16 }}>
        <SectionTitle title={skill ? `${skill} gigs` : 'Recommended for you'} />
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <FlatList
        data={feed}
        keyExtractor={(g) => g.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ gap: 12, paddingBottom: 130 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <GigCard gig={item} distance={km(item.city)} badge={mySkills.includes(item.skill) ? 'match' : undefined} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: item.id } })} />
          </View>
        )}
        ListEmptyComponent={<EmptyBlock icon="search-outline" title="No gigs right now" message={`Try another skill or widen your radius. Your rate: ${formatMoney(account.dayRate ?? 0)}/day.`} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 12 },
  bell: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5 },
  today: { borderRadius: 22, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  go: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  stat: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 12, gap: 2 },
  filters: { gap: 8, paddingHorizontal: 16 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
});
