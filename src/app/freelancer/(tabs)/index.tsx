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
import { FREELANCE_SKILLS } from '@/data/skills';
import { myApplication, useFreelancerWorkspace } from '@/hooks/useWorkspace';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatINR } from '@/utils/format';

export default function DiscoverGigs() {
  const t = useRoleTheme();
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const { open, applied } = useFreelancerWorkspace(account);
  const unread = useInbox(account).filter((n) => !n.read).length;
  const mySkills = account.skills ?? [];
  const [skill, setSkill] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);

  const upcoming = open.filter((g) => daysUntil(g.date) >= 0);
  const feed = upcoming
    .filter((g) => (!skill || g.skill === skill) && (!nearMe || g.city === account.city))
    .sort((a, b) => Number(mySkills.includes(b.skill)) - Number(mySkills.includes(a.skill)) || a.date.localeCompare(b.date));
  const matched = upcoming.filter((g) => mySkills.includes(g.skill));
  const today = applied.find((g) => myApplication(g, account.id)?.status === 'hired' && daysUntil(g.date) === 0);
  const skillOrder = [...mySkills, ...FREELANCE_SKILLS.filter((s) => !mySkills.includes(s))];

  const header = (
    <View style={{ gap: 18, paddingBottom: 6 }}>
      <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
        <View style={{ flex: 1 }}>
          <Text size={14} color={t.c.muted}>
            Hey {account.name.split(' ')[0]} 👋
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
        <Pressable onPress={() => router.push({ pathname: '/freelancer/job/[id]', params: { id: today.id } })} accessibilityRole="button" style={{ marginHorizontal: 16 }}>
          <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.today}>
            <View style={{ flex: 1 }}>
              <Text size={12} weight="bold" color={t.c.onPrimary} tracking={1}>
                ● YOU’RE WORKING TODAY
              </Text>
              <Text size={17} weight="bold" color={t.c.onPrimary} numberOfLines={1}>
                {today.title}
              </Text>
              <Text size={13} color={t.c.onPrimary}>
                {today.startTime} · {today.city} · {formatINR(today.pay)}
              </Text>
            </View>
            <View style={[styles.go, { backgroundColor: t.c.onPrimary }]}>
              <Ionicons name="arrow-forward" size={20} color={t.c.primary} />
            </View>
          </LinearGradient>
        </Pressable>
      )}

      <View style={styles.statsRow}>
        <View style={[styles.stat, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
          <Text size={24} weight="bold" color={t.c.primary}>
            {matched.length}
          </Text>
          <Text size={12} color={t.c.muted}>
            gigs match your skills
          </Text>
        </View>
        <View style={[styles.stat, { backgroundColor: t.c.surface, borderColor: t.c.border }]}>
          <Text size={24} weight="bold" color={t.c.textStrong}>
            {upcoming.filter((g) => g.city === account.city).length}
          </Text>
          <Text size={12} color={t.c.muted}>
            open in {account.city}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            setNearMe((v) => !v);
          }}
          style={[styles.filter, { borderColor: nearMe ? t.c.primary : t.c.border, backgroundColor: nearMe ? t.c.primary : t.c.surface }]}>
          <Ionicons name="location" size={14} color={nearMe ? t.c.onPrimary : t.c.muted} />
          <Text size={13} weight="semibold" color={nearMe ? t.c.onPrimary : t.c.text}>
            Near me
          </Text>
        </Pressable>
        {skillOrder.map((s) => {
          const on = skill === s;
          return (
            <Pressable
              key={s}
              onPress={() => {
                triggerHaptic('selection');
                setSkill(on ? null : s);
              }}
              style={[styles.filter, { borderColor: on ? t.c.primary : t.c.border, backgroundColor: on ? t.c.primary : t.c.surface }]}>
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
            <GigCard gig={item} badge={mySkills.includes(item.skill) ? 'match' : undefined} onPress={() => router.push({ pathname: '/freelancer/gig/[id]', params: { id: item.id } })} />
          </View>
        )}
        ListEmptyComponent={<EmptyBlock icon="search-outline" title="No gigs right now" message="Try another skill or turn off “Near me”. New gigs are posted daily." />}
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
  stat: { flex: 1, borderRadius: 20, borderWidth: 1, padding: 14, gap: 2 },
  filters: { gap: 8, paddingHorizontal: 16 },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14 },
});
