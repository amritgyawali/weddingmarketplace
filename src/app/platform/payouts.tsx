import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatINR, formatShortDate } from '@/utils/format';

export default function Payouts() {
  const t = useRoleTheme();
  const payouts = useDb((s) => s.payouts);
  const releasePayout = useDb((s) => s.releasePayout);
  const accounts = useSession((s) => s.accounts);
  const pending = payouts.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Freelancer payouts" subtitle={`${formatINR(pending)} awaiting release`} />
      <FlatList
        data={[...payouts].sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending') || b.date.localeCompare(a.date))}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: 30 }}
        ListEmptyComponent={<EmptyBlock icon="wallet-outline" title="No payouts" />}
        renderItem={({ item }) => {
          const who = accounts.find((a) => a.id === item.freelancerId)?.name ?? 'Freelancer';
          return (
            <Card style={{ gap: 8 }}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text size={15} weight="bold" color={t.c.textStrong}>
                    {who}
                  </Text>
                  <Text size={12} color={t.c.muted} numberOfLines={1}>
                    {item.title} · {formatShortDate(item.date)}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text size={16} weight="bold" color={t.c.textStrong}>
                    {formatINR(item.amount)}
                  </Text>
                  <StatusPill status={item.status} />
                </View>
              </View>
              {item.status === 'pending' && (
                <KButton
                  label="Release payout"
                  size="sm"
                  variant="success"
                  onPress={() => {
                    releasePayout(item.id);
                    toast(`${formatINR(item.amount)} released to ${who}`, 'cash');
                  }}
                />
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
