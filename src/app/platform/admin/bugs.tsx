import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BUG_PILL, reporterLine } from '@/components/admin/bugs';
import { Card, EmptyBlock, KButton, Segmented, StatusPill } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { Hint, StatRow, ToolPage } from '@/components/toolkit/core';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { useBugReports } from '@/hooks/useBugReports';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { BugReportStatus } from '@/types/platform';
import { timeAgo } from '@/utils/format';

type Filter = BugReportStatus | 'all';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'fixed', label: 'Fixed' },
  { id: 'dismissed', label: 'Dismissed' },
  { id: 'all', label: 'All' },
];

/** Every bug report sent with shake to report, from every role, newest first. */
function BugReports() {
  const t = useRoleTheme();
  const { reports, loading, error, refresh } = useBugReports();
  const [filter, setFilter] = useState<Filter>('new');
  const counts = { new: 0, fixed: 0, dismissed: 0, all: reports.length } as Record<Filter, number>;
  for (const r of reports) counts[r.status] += 1;
  const shown = filter === 'all' ? reports : reports.filter((r) => r.status === filter);

  return (
    <ToolPage title="Bug reports" subtitle={`${counts.new} new`} right={<KButton label="Refresh" icon="refresh-outline" size="sm" variant="secondary" onPress={refresh} />}>
      <Hint>Anyone using the app can shake the phone on a screen that went wrong (Alt+Shift+B on a computer). The screenshot, what they wrote, the screen and their device land here.</Hint>
      <StatRow
        items={[
          { label: 'New', value: String(counts.new), alert: counts.new > 0 },
          { label: 'Fixed', value: String(counts.fixed) },
          { label: 'All', value: String(counts.all) },
        ]}
      />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} counts={counts} />
      {error ? (
        <EmptyBlock icon="cloud-offline-outline" title="Couldn’t load bug reports" message={error} action="Try again" onAction={refresh} />
      ) : loading ? (
        <Text size={14} color={t.c.muted}>
          Loading…
        </Text>
      ) : shown.length === 0 ? (
        <EmptyBlock icon="bug-outline" title={filter === 'new' ? 'No new bug reports' : 'Nothing here'} message="Reports people send by shaking their phone show up here." />
      ) : (
        shown.map((r) => (
          <PressableScale key={r.id} onPress={() => router.push({ pathname: '/platform/admin/bug/[id]', params: { id: r.id } })} accessibilityRole="button" accessibilityLabel={r.description}>
            <Card style={styles.row}>
              {r.screenshot ? (
                <Image source={{ uri: r.screenshot }} style={[styles.thumb, { borderColor: t.c.border }]} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.noThumb, { borderColor: t.c.border, backgroundColor: t.c.surfaceAlt }]}>
                  <Text size={10} color={t.c.muted} align="center">
                    No picture
                  </Text>
                </View>
              )}
              <View style={{ flex: 1, gap: 4 }}>
                <Text raw size={15} weight="semibold" color={t.c.textStrong} numberOfLines={2}>
                  {r.description}
                </Text>
                <Text raw size={12} color={t.c.muted} numberOfLines={1}>
                  {r.route}
                </Text>
                <Text size={12} color={t.c.muted} numberOfLines={1}>
                  {reporterLine(r)} · {r.device.os} · {timeAgo(r.receivedAt)}
                </Text>
              </View>
              <StatusPill status={BUG_PILL[r.status].status} label={BUG_PILL[r.status].label} />
            </Card>
          </PressableScale>
        ))
      )}
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/bugs', BugReports);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  thumb: { width: 54, height: 96, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  noThumb: { alignItems: 'center', justifyContent: 'center', padding: 4 },
});
