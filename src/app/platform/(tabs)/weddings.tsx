import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Avatar, Card, EmptyBlock, KField, ProgressBar, RoleHeader, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { STATUS_LABEL } from '@/components/work/Pipeline';
import { useLayout } from '@/hooks/useLayout';
import { planningProgress } from '@/services/planner';
import { projectEconomics } from '@/services/pricing';
import { projectRisks } from '@/services/risk';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Project } from '@/types/platform';
import { daysUntil, formatMoneyCompact, formatShortDate } from '@/utils/format';

type Filter = 'active' | 'confirmed' | 'live' | 'completed' | 'self' | 'all';

const test = (f: Filter, p: Project) => {
  switch (f) {
    case 'active':
      return !['COMPLETED', 'CLOSED', 'CANCELLED', 'QUOTE_REJECTED'].includes(p.status);
    case 'confirmed':
      return p.status === 'CONFIRMED';
    case 'live':
      return p.status === 'IN_PROGRESS';
    case 'completed':
      return p.status === 'COMPLETED' || p.status === 'CLOSED';
    case 'self':
      return p.managedBy === 'self';
    default:
      return true;
  }
};

export default function PlatformWeddings() {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const projects = useDb((s) => s.projects);
  const [filter, setFilter] = useState<Filter>('active');
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const list = projects.filter((p) => test(filter, p) && (!q || `${p.title} ${p.code} ${p.city} ${p.customerName}`.toLowerCase().includes(q))).sort((a, b) => a.weddingDate.localeCompare(b.weddingDate));
  const counts = Object.fromEntries((['active', 'confirmed', 'live', 'completed', 'self', 'all'] as Filter[]).map((f) => [f, projects.filter((p) => test(f, p)).length])) as Record<Filter, number>;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader title="Weddings" subtitle={`${projects.length} projects · ${counts.active} active`} />
      <View style={{ paddingTop: 12, gap: 10 }}>
        <View style={{ paddingHorizontal: 14 }}>
          <KField placeholder="Search code, couple or city" value={query} onChangeText={setQuery} />
        </View>
        <Segmented
          options={[
            { id: 'active', label: 'Active' },
            { id: 'confirmed', label: 'Confirmed' },
            { id: 'live', label: 'In progress' },
            { id: 'completed', label: 'Completed' },
            { id: 'self', label: 'Direct bookings' },
            { id: 'all', label: 'All' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
      </View>
      <FlatList
        key={columns}
        data={list}
        numColumns={columns}
        keyExtractor={(p) => p.id}
        columnWrapperStyle={columns > 1 ? { gap: 10 } : undefined}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        ListEmptyComponent={<EmptyBlock icon="heart-outline" title="No weddings match" />}
        renderItem={({ item }) => {
          const progress = planningProgress(item);
          const econ = projectEconomics(item);
          const days = daysUntil(item.weddingDate);
          const risks = projectRisks(item).filter((r) => r.severity === 'high').length;
          return (
            <Card onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: item.id } })} style={{ gap: 10, flex: 1 }} accessibilityLabel={`${item.code} ${item.title}`}>
              <View style={styles.row}>
                <Avatar name={item.title} size={42} />
                <View style={{ flex: 1 }}>
                  <Text size={12} weight="medium" color={t.c.muted}>
                    {item.code} · {item.managedBy === 'platform' ? (item.coordinatorName ?? 'Unassigned') : 'Direct booking'}
                  </Text>
                  <Text size={16} weight="bold" color={t.c.textStrong}>
                    {item.title}
                  </Text>
                  <Text size={12} color={t.c.muted}>
                    {item.city} · {formatShortDate(item.weddingDate)} · {days >= 0 ? `${days}d to go` : 'past'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <StatusPill status={item.status} label={STATUS_LABEL[item.status]} />
                  {risks > 0 && (
                    <View style={styles.row}>
                      <Ionicons name="warning" size={12} color={t.c.danger} />
                      <Text size={11} color={t.c.danger}>
                        {risks} risk{risks > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.grid}>
                <Text size={12} color={t.c.muted}>
                  Services {progress.services.confirmed}/{progress.services.total}
                </Text>
                <Text size={12} color={t.c.muted}>
                  GMV {formatMoneyCompact(econ.gmv)}
                </Text>
                <Text size={12} color={t.c.muted}>
                  Paid {formatMoneyCompact(progress.pay.paid)}
                </Text>
              </View>
              <ProgressBar value={progress.overall} />
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  grid: { flexDirection: 'row', justifyContent: 'space-between' },
});
