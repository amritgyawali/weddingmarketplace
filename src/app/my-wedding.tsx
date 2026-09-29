import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, Segmented, StatusPill } from '@/components/kit';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ProjectWorkspace } from '@/components/work/ProjectWorkspace';
import { colors } from '@/constants/theme';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { quoteTotals } from '@/services/quotes';
import { useAppStore } from '@/store/useAppStore';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { formatINR, formatShortDate } from '@/utils/format';

type Tab = 'plan' | 'quotes';

/** The couple's single view of their wedding: plan, run sheet, payments and quotations. */
export default function MyWedding() {
  const account = useAccount();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const { project, quotes } = useCustomerWorkspace(account.id);
  const weddingDate = useAppStore((s) => s.weddingDate);
  const city = useAppStore((s) => s.city);
  const ensureProject = useDb((s) => s.ensureCustomerProject);
  const [tab, setTab] = useState<Tab>(params.tab ?? 'plan');
  const awaiting = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').length;

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Wedding" subtitle={project ? `${project.code} · ${project.city}` : undefined} />
      <View style={{ paddingTop: 12 }}>
        <Segmented
          options={[
            { id: 'plan', label: 'Wedding plan' },
            { id: 'quotes', label: 'Quotations' },
          ]}
          value={tab}
          onChange={setTab}
          counts={{ quotes: awaiting || undefined }}
        />
      </View>

      {tab === 'plan' ? (
        project ? (
          <ProjectWorkspace project={project} mode="customer" />
        ) : (
          <View style={{ padding: 16 }}>
            <EmptyBlock
              icon="heart-outline"
              title="Start your wedding plan"
              message="Create your planning workspace to track vendors, payments, tasks and the wedding-day run sheet."
              action="Create my wedding plan"
              onAction={() => {
                ensureProject(account, { weddingDate, city: city === 'All Cities' ? account.city : city });
                toast('Your wedding plan is ready 💕');
              }}
            />
          </View>
        )
      ) : (
        <FlatList
          data={[...quotes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyBlock
              icon="document-text-outline"
              title="No quotations yet"
              message="Send an enquiry to a venue or vendor — their quotation will appear here for you to compare and accept."
              action="Explore venues"
              onAction={() => router.navigate('/venues')}
            />
          }
          renderItem={({ item }) => (
            <Card onPress={() => router.push({ pathname: '/quote/[id]', params: { id: item.id } })} style={{ gap: 8 }} accessibilityLabel={`Quotation from ${item.fromName}`}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text size={12} weight="bold" color={colors.primary}>
                    {item.number}
                  </Text>
                  <Text size={16} weight="bold" color={colors.heading}>
                    {item.fromName}
                  </Text>
                  <Text size={12} color={colors.textMuted}>
                    Received {formatShortDate(item.createdAt)} · valid till {formatShortDate(item.validUntil)}
                  </Text>
                </View>
                <StatusPill status={item.status === 'viewed' ? 'sent' : item.status} label={item.status === 'sent' || item.status === 'viewed' ? 'Awaiting you' : undefined} />
              </View>
              <View style={styles.row}>
                <Text size={13} color={colors.textBody} style={{ flex: 1 }}>
                  {item.items.length} items
                </Text>
                <Text size={18} weight="bold" color={colors.textStrong}>
                  {formatINR(quoteTotals(item).total)}
                </Text>
              </View>
              {(item.status === 'sent' || item.status === 'viewed') && (
                <Text size={14} weight="bold" color={colors.primary}>
                  Review & respond →
                </Text>
              )}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
