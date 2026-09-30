import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, KeyValue, KField, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { RunSheet, SeverityPicker } from '@/components/work/RunSheet';
import { myApplication } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { daysUntil, formatMoney, formatLongDate, formatTime } from '@/utils/format';

/** Hired-job view: on-site check-in/out, the live run sheet and issue reporting. */
export default function FreelancerJob() {
  const t = useRoleTheme();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const gig = useDb((s) => s.gigs.find((g) => g.id === id));
  const project = useDb((s) => s.projects.find((p) => p.id === gig?.projectId));
  const checkIn = useDb((s) => s.checkIn);
  const checkOut = useDb((s) => s.checkOut);
  const reportIncident = useDb((s) => s.reportIncident);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issue, setIssue] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');

  if (!gig) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Job" />
        <EmptyBlock title="Job not found" />
      </View>
    );
  }

  const app = myApplication(gig, account.id);
  const days = daysUntil(gig.date);
  const event = project?.events.find((e) => e.id === gig.eventId);
  const onSite = !!app?.checkInAt && !app?.checkOutAt;
  const canCheckIn = (app?.status === 'hired' || app?.status === 'confirmed') && !app.checkInAt && days <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={gig.title} subtitle={gig.postedByName} right={app ? <StatusPill status={app.status} /> : undefined} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Card style={[styles.hero, { borderColor: onSite ? t.c.success : t.c.primary }]}>
          <Ionicons name={onSite ? 'radio' : app?.status === 'completed' ? 'checkmark-done-circle' : 'calendar'} size={30} color={onSite ? t.c.success : t.c.primary} />
          <View style={{ flex: 1 }}>
            <Text size={18} weight="bold" color={t.c.textStrong}>
              {app?.status === 'completed' ? 'Job completed' : onSite ? 'You’re on site' : days === 0 ? 'Today' : days > 0 ? `In ${days} days` : 'Past job'}
            </Text>
            <Text size={13} color={t.c.muted}>
              {formatLongDate(gig.date)} · report at {gig.startTime} · {gig.city}
            </Text>
            {app?.checkInAt && (
              <Text size={12} color={t.c.success}>
                Checked in {formatTime(app.checkInAt)}
                {app.checkOutAt ? ` · out ${formatTime(app.checkOutAt)}` : ''}
              </Text>
            )}
          </View>
        </Card>

        {(app?.status === 'hired' || app?.status === 'confirmed' || app?.status === 'checked_in') && (
          <View style={{ gap: 8 }}>
            {!app.checkInAt ? (
              <KButton
                label={canCheckIn ? 'Check in on site' : `Check-in opens on ${formatLongDate(gig.date)}`}
                icon="location"
                size="lg"
                disabled={!canCheckIn}
                onPress={() => {
                  checkIn(gig.id, app.id);
                  triggerHaptic('success');
                  toast('Checked in — have a great shift!', 'location');
                }}
              />
            ) : (
              <KButton
                label="Check out & request payout"
                icon="log-out-outline"
                variant="success"
                size="lg"
                onPress={() => {
                  checkOut(gig.id, app.id);
                  triggerHaptic('success');
                  toast('Checked out — payout requested', 'wallet');
                }}
              />
            )}
            {onSite && project && (
              <KButton label="Report an issue" icon="warning-outline" variant="danger" size="sm" onPress={() => setIssueOpen(true)} />
            )}
          </View>
        )}

        <Card style={{ gap: 4 }}>
          <KeyValue label="Pay" value={formatMoney(app?.expectedPay ?? gig.pay)} />
          <KeyValue label="Duration" value={`${gig.hours} hours`} />
          {project && <KeyValue label="Wedding" value={`${project.title} (${project.code})`} />}
          {event && <KeyValue label="Function" value={`${event.name} · ${event.venue}`} />}
        </Card>

        {!!gig.description && (
          <Card style={{ gap: 6 }}>
            <Text size={15} weight="bold" color={t.c.textStrong}>
              Brief
            </Text>
            <Text size={14} color={t.c.text} lineHeight={21}>
              {gig.description}
            </Text>
          </Card>
        )}

        {project && event && (
          <Card style={{ gap: 10 }}>
            <SectionTitle title={`${event.name} run sheet`} />
            <RunSheet project={project} event={event} editable={onSite} />
            {!onSite && (
              <Text size={12} color={t.c.muted}>
                You can update cues once you check in.
              </Text>
            )}
          </Card>
        )}
      </ScrollView>

      <Sheet visible={issueOpen} onClose={() => setIssueOpen(false)} title="Report an issue">
        <View style={{ paddingHorizontal: 20, gap: 14 }}>
          <KField placeholder="What happened?" value={issue} onChangeText={setIssue} multiline />
          <SeverityPicker value={severity} onChange={setSeverity} />
          <KButton
            label="Send to control room"
            variant="danger"
            disabled={!issue.trim()}
            onPress={() => {
              if (!project) return;
              reportIncident(project.id, { eventId: event?.id ?? project.events[0].id, title: issue.trim(), severity, reportedBy: `${account.name} (crew)` });
              setIssue('');
              setIssueOpen(false);
              toast('Issue reported to Vivah ops', 'warning');
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1 },
});
