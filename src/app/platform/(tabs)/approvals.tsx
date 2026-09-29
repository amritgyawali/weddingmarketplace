import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, RoleHeader, Segmented, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Approval } from '@/types/platform';
import { formatShortDate } from '@/utils/format';

const KIND_ICON: Record<Approval['kind'], React.ComponentProps<typeof Ionicons>['name']> = {
  vendor: 'storefront-outline',
  freelancer: 'person-outline',
  review: 'chatbox-ellipses-outline',
};

export default function Approvals() {
  const t = useRoleTheme();
  const approvals = useDb((s) => s.approvals);
  const decide = useDb((s) => s.decideApproval);
  const [filter, setFilter] = useState<Approval['status']>('pending');

  const list = approvals.filter((a) => a.status === filter).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  const counts = { pending: 0, approved: 0, rejected: 0 };
  approvals.forEach((a) => (counts[a.status] += 1));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="TRUST & SAFETY" title="Approvals" subtitle="Verify vendors, freelancers and reviews" />
      <View style={{ paddingTop: 12 }}>
        <Segmented
          options={[
            { id: 'pending', label: 'Pending' },
            { id: 'approved', label: 'Approved' },
            { id: 'rejected', label: 'Rejected' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
      </View>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        ListEmptyComponent={<EmptyBlock icon="shield-checkmark-outline" title={filter === 'pending' ? 'All caught up' : `Nothing ${filter}`} message={filter === 'pending' ? 'New sign-ups and flagged reviews will appear here.' : undefined} />}
        renderItem={({ item }) => (
          <Card style={{ gap: 10 }}>
            <View style={styles.row}>
              <View style={[styles.icon, { backgroundColor: t.c.soft }]}>
                <Ionicons name={KIND_ICON[item.kind]} size={20} color={t.c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text size={11} weight="bold" color={t.c.muted}>
                  {item.kind.toUpperCase()} · {formatShortDate(item.submittedAt)}
                </Text>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  {item.title}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {item.subtitle}
                </Text>
              </View>
              <StatusPill status={item.status} />
            </View>
            {item.details.map((d) => (
              <Text key={d} size={13} color={t.c.text}>
                • {d}
              </Text>
            ))}
            {item.status === 'pending' && (
              <View style={styles.row}>
                <KButton
                  label={item.kind === 'review' ? 'Remove review' : 'Reject'}
                  variant="danger"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => {
                    decide(item.id, false);
                    toast(item.kind === 'review' ? 'Review removed' : `${item.title} rejected`, 'close-circle');
                  }}
                />
                <KButton
                  label={item.kind === 'review' ? 'Keep review' : 'Approve'}
                  variant="success"
                  size="sm"
                  style={{ flex: 1 }}
                  onPress={() => {
                    decide(item.id, true);
                    toast(item.kind === 'review' ? 'Review kept' : `${item.title} verified`, 'shield-checkmark');
                  }}
                />
              </View>
            )}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});
