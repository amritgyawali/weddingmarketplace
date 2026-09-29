import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, ProgressBar, RoleHeader, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ProjectStage } from '@/types/platform';
import { daysUntil, formatINR, formatLongDate } from '@/utils/format';

type Filter = 'active' | ProjectStage | 'all';

export default function ProjectsTab() {
  const t = useRoleTheme();
  const account = useAccount();
  const { projects } = useVendorWorkspace(account);
  const [filter, setFilter] = useState<Filter>('active');

  const list = projects
    .filter((p) => (filter === 'all' ? true : filter === 'active' ? p.stage !== 'completed' : p.stage === filter))
    .sort((a, b) => a.weddingDate.localeCompare(b.weddingDate));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="BOOKED WEDDINGS" title="Projects" subtitle={`${projects.filter((p) => p.stage !== 'completed').length} active`} />
      <View style={{ paddingTop: 14 }}>
        <Segmented
          options={[
            { id: 'active', label: 'Active' },
            { id: 'execution', label: 'Live' },
            { id: 'completed', label: 'Completed' },
            { id: 'all', label: 'All' },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyBlock icon="calendar-outline" title="No projects" message="When a couple accepts your quotation, the wedding appears here with its run sheet, tasks and payments." />}
        renderItem={({ item }) => {
          const mine = item.vendors.find((v) => v.vendorAccountId === account.id || v.listingId === account.listingId);
          const myPayments = item.payments.filter((m) => m.payee === mine?.name);
          const received = myPayments.filter((m) => m.status === 'paid').reduce((s, m) => s + m.amount, 0);
          const days = daysUntil(item.weddingDate);
          return (
            <Card onPress={() => router.push({ pathname: '/business/project/[id]', params: { id: item.id } })} style={{ gap: 12 }} accessibilityLabel={item.title}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text size={12} weight="bold" color={t.c.primary}>
                    {item.code}
                  </Text>
                  <Text size={17} weight="bold" color={t.c.textStrong}>
                    {item.title}
                  </Text>
                  <Text size={13} color={t.c.muted}>
                    {formatLongDate(item.weddingDate)} · {item.guests} guests
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <StatusPill status={item.stage} />
                  <Text size={12} weight="bold" color={days < 0 ? t.c.muted : t.c.primary}>
                    {days >= 0 ? `${days} days` : 'Done'}
                  </Text>
                </View>
              </View>
              {mine && (
                <View style={{ gap: 6 }}>
                  <View style={styles.row}>
                    <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
                      Received {formatINR(received)} of {formatINR(mine.amount)}
                    </Text>
                    <Text size={12} weight="bold" color={t.c.textStrong}>
                      {Math.round((received / Math.max(1, mine.amount)) * 100)}%
                    </Text>
                  </View>
                  <ProgressBar value={received / Math.max(1, mine.amount)} />
                </View>
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
});
