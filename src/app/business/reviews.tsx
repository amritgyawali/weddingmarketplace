import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, KField, ProgressBar, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { summarizeReviews } from '@/services/planner';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { timeAgo } from '@/utils/format';

/** Reviews with per-category ratings, AI summary and public replies. */
export default function VendorReviews() {
  const t = useRoleTheme();
  const account = useAccount();
  const { reviews, listing } = useVendorWorkspace(account);
  const reply = useDb((s) => s.replyToReview);
  const flag = useDb((s) => s.flagReview);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const published = reviews.filter((r) => r.status === 'published');
  const summary = summarizeReviews(published.map((r) => ({ rating: r.overall, text: r.text })));
  const criteria = [...new Set(published.flatMap((r) => Object.keys(r.criteria)))];
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: published.filter((r) => Math.round(r.overall) === n).length }));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Reviews" subtitle={`${published.length} on Vivah · ${listing?.reviewCount ?? 0} total`} />
      <FlatList
        data={reviews}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListHeaderComponent={
          published.length ? (
            <Card style={{ gap: 10, marginBottom: 4 }}>
              <View style={styles.row}>
                <Text size={36} weight="extrabold" color={t.c.primary}>
                  {summary.average.toFixed(1)}
                </Text>
                <View style={{ flex: 1, gap: 3 }}>
                  {dist.map((d) => (
                    <View key={d.n} style={styles.row}>
                      <Text size={11} color={t.c.muted} style={{ width: 14 }}>
                        {d.n}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <ProgressBar value={published.length ? d.count / published.length : 0} height={5} />
                      </View>
                    </View>
                  ))}
                </View>
              </View>
              {criteria.map((c) => {
                const vals = published.map((r) => r.criteria[c]).filter((v): v is number => typeof v === 'number');
                const avg = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
                return (
                  <View key={c} style={styles.row}>
                    <Text size={12} color={t.c.text} style={{ width: 130 }}>
                      {c}
                    </Text>
                    <View style={{ flex: 1 }}>
                      <ProgressBar value={avg / 5} />
                    </View>
                    <Text size={12} weight="bold" color={t.c.textStrong}>
                      {avg.toFixed(1)}
                    </Text>
                  </View>
                );
              })}
              {summary.highlights.length > 0 && (
                <Text size={12} color={t.c.success}>
                  Couples love: {summary.highlights.join(', ')}
                </Text>
              )}
              {summary.concerns.length > 0 && (
                <Text size={12} color={t.c.warning}>
                  Watch out for: {summary.concerns.join(', ')}
                </Text>
              )}
            </Card>
          ) : null
        }
        ListEmptyComponent={<EmptyBlock icon="star-outline" title="No reviews yet" message="Couples are asked to review you after each completed booking." />}
        renderItem={({ item }) => (
          <Card style={{ gap: 8 }}>
            <View style={styles.rowBetween}>
              <Text size={14} weight="bold" color={t.c.textStrong}>
                {item.overall}★ · {item.authorName}
              </Text>
              <Text size={11} color={t.c.muted}>
                {item.verifiedBooking ? '✓ Verified booking · ' : ''}
                {timeAgo(item.at)}
              </Text>
            </View>
            <Text size={11} color={t.c.muted}>
              {Object.entries(item.criteria).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </Text>
            <Text size={14} color={t.c.text}>
              {item.text}
            </Text>
            {item.reply ? (
              <View style={[styles.reply, { backgroundColor: t.c.surfaceAlt }]}>
                <Text size={12} weight="bold" color={t.c.primary}>
                  Your reply
                </Text>
                <Text size={13} color={t.c.text}>
                  {item.reply.text}
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                <KField placeholder="Reply publicly…" value={drafts[item.id] ?? ''} onChangeText={(v) => setDrafts((d) => ({ ...d, [item.id]: v }))} multiline />
                <View style={styles.row}>
                  <KButton label="Report" size="sm" variant="ghost" onPress={() => { flag(item.id, `Reported by ${account.businessName}`); toast('Sent to moderation'); }} />
                  <KButton label="Reply" size="sm" style={{ flex: 1 }} disabled={!drafts[item.id]?.trim()} onPress={() => { reply(item.id, drafts[item.id].trim()); toast('Reply posted'); }} />
                </View>
              </View>
            )}
          </Card>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  reply: { borderRadius: 10, padding: 10, gap: 2 },
});
