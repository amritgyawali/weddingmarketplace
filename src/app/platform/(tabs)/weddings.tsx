import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Card, EmptyBlock, KField, ProgressBar, RoleHeader, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ProjectStage } from '@/types/platform';
import { daysUntil, formatINRCompact, formatShortDate } from '@/utils/format';

type Filter = 'all' | ProjectStage | 'genie';

export default function PlatformWeddings() {
  const t = useRoleTheme();
  const projects = useDb((s) => s.projects);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const list = projects
    .filter((p) => (filter === 'all' ? true : filter === 'genie' ? p.managedBy === 'platform' : p.stage === filter))
    .filter((p) => !q || `${p.title} ${p.code} ${p.city} ${p.customerName}`.toLowerCase().includes(q))
    .sort((a, b) => a.weddingDate.localeCompare(b.weddingDate));

  const count = (f: Filter) => projects.filter((p) => (f === 'all' ? true : f === 'genie' ? p.managedBy === 'platform' : p.stage === f)).length;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="PROJECT MANAGEMENT" title="Weddings" subtitle={`${projects.length} projects on the platform`} />
      <View style={{ paddingTop: 12, gap: 10 }}>
        <View style={{ paddingHorizontal: 14 }}>
          <KField placeholder="Search code, couple or city" value={query} onChangeText={setQuery} />
        </View>
        <Segmented
          options={[
            { id: 'all', label: 'All' },
            { id: 'genie', label: 'Genie managed' },
            { id: 'planning', label: 'Planning' },
            { id: 'booked', label: 'Booked' },
            { id: 'execution', label: 'Live' },
            { id: 'completed', label: 'Completed' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={{ all: count('all'), genie: count('genie'), planning: count('planning'), booked: count('booked'), execution: count('execution'), completed: count('completed') }}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        ListEmptyComponent={<EmptyBlock icon="heart-outline" title="No weddings match" />}
        renderItem={({ item }) => {
          const done = item.tasks.filter((x) => x.status === 'done').length;
          const days = daysUntil(item.weddingDate);
          const booked = item.vendors.filter((v) => v.status === 'booked');
          return (
            <Card onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: item.id } })} style={{ gap: 10 }} accessibilityLabel={`${item.code} ${item.title}`}>
              <View style={styles.row}>
                <Avatar name={item.title} size={42} />
                <View style={{ flex: 1 }}>
                  <Text size={12} weight="bold" color={t.c.primary}>
                    {item.code} · {item.managedBy === 'platform' ? 'Genie' : 'Self-managed'}
                  </Text>
                  <Text size={16} weight="bold" color={t.c.textStrong}>
                    {item.title}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {item.city} · {formatShortDate(item.weddingDate)} · {days >= 0 ? `${days}d to go` : 'done'}
                  </Text>
                </View>
                <StatusPill status={item.stage} />
              </View>
              <View style={styles.grid}>
                <Text size={12} color={t.c.muted}>
                  Vendors {booked.length}/{item.vendors.length} · {formatINRCompact(booked.reduce((s, v) => s + v.amount, 0))}
                </Text>
                <Text size={12} color={t.c.muted}>
                  Tasks {done}/{item.tasks.length}
                </Text>
              </View>
              <ProgressBar value={item.tasks.length ? done / item.tasks.length : 0} />
              {item.plannerName && (
                <Text size={12} color={t.c.muted}>
                  Planner: {item.plannerName}
                </Text>
              )}
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
});
