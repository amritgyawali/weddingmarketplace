import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { BUG_PILL, reporterLine } from '@/components/admin/bugs';
import { Card, EmptyBlock, KButton, KeyValue, KField, SectionTitle, StatusPill } from '@/components/kit';
import { staffScreen } from '@/components/persona/StaffGate';
import { ToolPage } from '@/components/toolkit/core';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { useBugReport, useBugReportActions } from '@/hooks/useBugReports';
import { impersonate } from '@/services/auth';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { BugReportStatus } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatLongDate, formatTime } from '@/utils/format';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

/** One bug report: the screenshot, what they wrote, where and on what device, and what the app logged. */
function BugReportDetail() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { report, loading, error } = useBugReport(id);
  const { setStatus, remove } = useBugReportActions();
  const reporter = useSession((s) => s.accounts.find((a) => a.id === report?.account?.id));
  const me = useSession((s) => s.session?.accountId);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <ToolPage title="Bug report">
        <Text size={14} color={t.c.muted}>
          Loading…
        </Text>
      </ToolPage>
    );
  }
  if (!report) {
    return (
      <ToolPage title="Bug report">
        <EmptyBlock icon="bug-outline" title="Bug report not found" message={error ?? 'It may have been deleted.'} action="All bug reports" onAction={() => router.replace('/platform/admin/bugs')} />
      </ToolPage>
    );
  }

  const mark = async (status: BugReportStatus) => {
    setBusy(true);
    const err = await setStatus(report.id, status, note);
    setBusy(false);
    if (err) return toastError(err);
    setNote('');
  };

  const { device, app } = report;
  const params = Object.entries(report.params ?? {});

  return (
    <ToolPage title="Bug report" subtitle={`${reporterLine(report)} · ${formatLongDate(report.receivedAt.slice(0, 10))} ${formatTime(report.receivedAt)}`} right={<StatusPill status={BUG_PILL[report.status].status} label={BUG_PILL[report.status].label} />}>
      <Card style={{ gap: 10 }}>
        <Text size={12} color={t.c.muted}>
          What went wrong
        </Text>
        <Text raw size={16} color={t.c.textStrong}>
          {report.description}
        </Text>
      </Card>

      <SectionTitle title="Screenshot" />
      {report.screenshot ? (
        <Card padded={false} style={{ overflow: 'hidden', alignItems: 'center', paddingVertical: 12 }}>
          <Image source={{ uri: report.screenshot }} style={[styles.shot, { aspectRatio: device.width && device.height ? device.width / device.height : 0.46, borderColor: t.c.border }]} contentFit="contain" accessibilityLabel="Screenshot" />
        </Card>
      ) : (
        <Card>
          <Text size={13} color={t.c.muted}>
            No screenshot with this report (older reports on this device drop theirs to save space).
          </Text>
        </Card>
      )}

      <SectionTitle title="Where" />
      <Card style={{ gap: 4 }}>
        <KeyValue label="Screen" value={report.route} />
        {params.map(([k, v]) => (
          <KeyValue key={k} label={k} value={v} />
        ))}
        <KeyValue label="Sent by" value={reporterLine(report)} />
        {!!report.account?.staffRole && <KeyValue label="Staff role" value={report.account.staffRole} />}
        <KeyValue label="Device" value={`${device.os} ${device.osVersion} · ${device.width}×${device.height} @${device.scale}x`} />
        <KeyValue label="Runs in" value={device.runtime} />
        <KeyValue label="App" value={`${app.name} ${app.version} · ${app.backend} · ${app.language.toUpperCase()} · ${app.calendar}`} />
        {!!device.userAgent && <KeyValue label="Browser" value={device.userAgent} />}
      </Card>
      {!!reporter && reporter.id !== me && (
        <KButton label={`Sign in as ${reporter.name.split(' ')[0]} to try it`} icon="eye-outline" variant="secondary" onPress={() => impersonate(reporter)} />
      )}

      {report.recentRoutes.length > 0 && (
        <>
          <SectionTitle title="Screens before it" />
          <Card style={{ gap: 6 }}>
            {report.recentRoutes.map((r, i) => (
              <Text key={`${r.at}-${i}`} raw size={12} color={t.c.text} style={{ fontFamily: MONO }}>
                {r.at}  {r.path}
              </Text>
            ))}
          </Card>
        </>
      )}

      {report.logs.length > 0 && (
        <>
          <SectionTitle title="Errors and warnings the app logged" />
          <Card style={{ gap: 8 }}>
            {report.logs.map((l, i) => (
              <Text key={`${l.at}-${i}`} raw size={11} color={l.level === 'error' ? t.c.danger : t.c.warning} style={{ fontFamily: MONO }} numberOfLines={8}>
                {l.at} {l.level}  {l.message}
              </Text>
            ))}
          </Card>
        </>
      )}

      <SectionTitle title="Status" />
      <Card style={{ gap: 12 }}>
        {report.status !== 'new' && (
          <Text size={13} color={t.c.muted}>
            {BUG_PILL[report.status].label}
            {report.resolvedBy ? ` by ${report.resolvedBy}` : ''}
            {report.resolvedAt ? ` · ${formatLongDate(report.resolvedAt.slice(0, 10))}` : ''}
          </Text>
        )}
        {!!report.note && (
          <Text raw size={14} color={t.c.text}>
            {report.note}
          </Text>
        )}
        <KField label="Note" value={note} onChangeText={setNote} placeholder="Optional: what was wrong, the PR that fixed it" multiline maxLength={500} />
        <View style={styles.actions}>
          {report.status !== 'fixed' && <KButton label="Mark fixed" icon="checkmark-circle-outline" loading={busy} style={{ flex: 1 }} onPress={() => void mark('fixed')} />}
          {report.status !== 'dismissed' && <KButton label="Dismiss" variant="secondary" loading={busy} style={{ flex: 1 }} onPress={() => void mark('dismissed')} />}
          {report.status !== 'new' && <KButton label="Reopen" icon="refresh-outline" variant="secondary" loading={busy} style={{ flex: 1 }} onPress={() => void mark('new')} />}
        </View>
        <KButton
          label="Delete"
          size="sm"
          variant="danger"
          icon="trash-outline"
          onPress={() =>
            confirm('Delete this bug report?', report.description.slice(0, 80), 'Delete', async () => {
              const err = await remove([report.id]);
              if (err) return toastError(err);
              router.back();
            })
          }
        />
      </Card>
    </ToolPage>
  );
}

export default staffScreen('/platform/admin/bug', BugReportDetail);

const styles = StyleSheet.create({
  shot: { width: '80%', maxWidth: 360, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
});
