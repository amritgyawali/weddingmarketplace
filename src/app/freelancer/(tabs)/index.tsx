import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyBlock, FilterChip, RoleHeader, SectionTitle } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { GigCard } from '@/components/work/GigCard';
import { cityDistanceKm } from '@/data/cities';
import { useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatClock, formatMoney, formatMoneyCompact } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type Sort = 'match' | 'pay' | 'date' | 'distance';

/** Gig marketplace for crew: invitations, emergencies and gigs for the freelancer's own skills only. */
export default function DiscoverGigs() {
  const t = useRoleTheme();
  const account = useAccount();
  const { open, invited, upcoming, payables } = useFreelancerWorkspace(account);
  const mySkills = account.skills ?? [];
  const radius = account.travelRadiusKm ?? 25;
  const [skill, setSkill] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [sort, setSort] = useState<Sort>('match');

  const km = (city: string) => cityDistanceKm(account.city, city);
  const emergencies = open.filter((g) => g.emergency && mySkills.includes(g.skill));
  // Strict: only gigs for a skill on the profile. Invitations are listed separately whatever the skill.
  const feed = open
    .filter((g) => mySkills.includes(g.skill) && !g.emergency && !g.invited?.includes(account.id))
    .filter((g) => (!skill || g.skill === skill) && (!nearMe || (km(g.city) ?? 999) <= radius))
    .sort((a, b) =>
      sort === 'pay'
        ? b.pay - a.pay
        : sort === 'date'
          ? a.date.localeCompare(b.date)
          : sort === 'distance'
            ? (km(a.city) ?? 999) - (km(b.city) ?? 999)
            : Number(b.skill === account.primarySkill) - Number(a.skill === account.primarySkill) || (km(a.city) ?? 999) - (km(b.city) ?? 999) || a.date.localeCompare(b.date),
    );
  const today = upcoming.find((x) => daysUntil(x.assignment.date) === 0);
  const month = payables.filter((p) => p.status === 'PAID' && new Date(p.paidAt ?? p.due).getMonth() === new Date().getMonth()).reduce((s, p) => s + p.amount, 0);
  const skillOrder = mySkills.length > 1 ? mySkills : [];

  const header = (
    <View style={{ gap: 16, paddingBottom: 6 }}>
      <RoleHeader title="Gigs" subtitle={`Namaste, ${account.name.split(' ')[0]} · ${mySkills.slice(0, 2).join(', ') || 'Crew'} · ${account.city}`}>
        <View style={styles.statsRow}>
          <Text size={14} color={t.c.muted}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              {open.filter((g) => mySkills.includes(g.skill)).length}
            </Text>{' '}
            match your skills
          </Text>
          <Text size={14} color={t.c.muted}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              {upcoming.length}
            </Text>{' '}
            booked
          </Text>
          <Text size={14} color={t.c.muted}>
            <Text size={14} weight="semibold" color={t.c.textStrong}>
              {formatMoneyCompact(month)}
            </Text>{' '}
            paid this month
          </Text>
        </View>
      </RoleHeader>

      {today && (
        <Pressable
          onPress={() => router.push({ pathname: '/freelancer/assignment/[id]', params: { id: today.assignment.id } })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.today, { backgroundColor: t.c.surface, borderColor: t.c.border, borderLeftColor: t.c.success }, pressed && { opacity: 0.8 }]}>
          <View style={{ flex: 1 }}>
            <Text size={13} weight="medium" color={t.c.success}>
              You’re working today
            </Text>
            <Text size={16} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
              {today.assignment.role} · {today.project.title}
            </Text>
            <Text size={13} color={t.c.muted}>
              {formatClock(today.assignment.startTime)} · {today.project.events.find((e) => e.id === today.assignment.eventId)?.venue ?? today.project.city} · {today.assignment.status === 'CHECKED_IN' ? 'checked in' : 'tap to check in'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={t.c.subtle} />
        </Pressable>
      )}

      {emergencies.length > 0 && (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SectionTitle title="Urgent: needed today" />
          {emergencies.map((g) => (
            <GigCard key={g.id} gig={g} distance={km(g.city)} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: g.id } })} />
          ))}
        </View>
      )}

      {invited.filter((g) => !emergencies.includes(g)).length > 0 && (
        <View style={{ paddingHorizontal: 16, gap: 10 }}>
          <SectionTitle title="You’re invited" />
          {invited
            .filter((g) => !emergencies.includes(g))
            .map((g) => (
              <GigCard key={g.id} gig={g} badge="invited" distance={km(g.city)} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: g.id } })} />
            ))}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <FilterChip label={`Within ${radius} km`} icon="location-outline" selected={nearMe} onPress={() => setNearMe((v) => !v)} />
        {(['match', 'pay', 'date', 'distance'] as Sort[]).map((s) => (
          <FilterChip key={s} label={s === 'match' ? 'Best match' : s === 'pay' ? 'Highest pay' : s === 'date' ? 'Soonest' : 'Nearest'} selected={sort === s} onPress={() => setSort(s)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {skillOrder.map((s) => (
          <FilterChip key={s} label={s} selected={skill === s} onPress={() => setSkill(skill === s ? null : s)} />
        ))}
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
        contentContainerStyle={{ gap: 12, paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 16 }}>
            <GigCard gig={item} distance={km(item.city)} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: item.id } })} />
          </View>
        )}
        ListEmptyComponent={
          <EmptyBlock
            icon="search-outline"
            title="No gigs for your skills right now"
            message={`You see gigs for ${mySkills.join(', ') || 'your skills'}. Widen your radius or add a skill in Your craft. Your rate: ${formatMoney(account.dayRate ?? 0)}/day.`}
            action="Your craft"
            onAction={() => router.push('/freelancer/craft')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  today: { marginHorizontal: 16, borderRadius: 8, borderWidth: 1, borderLeftWidth: 3, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 14, marginTop: 10 },
  filters: { gap: 8, paddingHorizontal: 16 },
});
