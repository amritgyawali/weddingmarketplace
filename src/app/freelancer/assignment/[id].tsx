import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KeyValue, KField, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { RunSheet, SeverityPicker } from '@/components/work/RunSheet';
import { findAssignment } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';
import { daysUntil, formatClock, formatLongDate, formatMoney, formatTime } from '@/utils/format';

/** A freelancer's wedding assignment: confirm, check in on site, work, check out, get paid. */
export default function AssignmentScreen() {
  const t = useRoleTheme();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const projects = useDb((s) => s.projects);
  const payables = useDb((s) => s.payables);
  const threads = useDb((s) => s.threads);
  const setStatus = useDb((s) => s.setAssignmentStatus);
  const checkIn = useDb((s) => s.checkInAssignment);
  const checkOut = useDb((s) => s.checkOutAssignment);
  const reportIncident = useDb((s) => s.reportIncident);
  const startEmergency = useDb((s) => s.startEmergencyReplacement);
  const [busy, setBusy] = useState(false);
  const [issueOpen, setIssueOpen] = useState(false);
  const [issue, setIssue] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [outOpen, setOutOpen] = useState(false);
  const [proof, setProof] = useState('');
  const [cantOpen, setCantOpen] = useState(false);
  const [reason, setReason] = useState('');
  const ref = findAssignment(projects, id);

  if (!ref) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Assignment" />
        <EmptyBlock title="Assignment not found" />
      </View>
    );
  }
  const { project, booking, assignment: a } = ref;
  const event = project.events.find((e) => e.id === a.eventId);
  const days = daysUntil(a.date);
  const onSite = a.status === 'CHECKED_IN' || a.status === 'IN_PROGRESS';
  const payout = payables.find((p) => p.assignmentId === a.id);
  const crew = booking.assignments.filter((x) => x.id !== a.id && x.eventId === a.eventId && !['CANCELLED', 'EMERGENCY_REPLACEMENT'].includes(x.status));
  const thread = threads.find((th) => th.bookingId === booking.id);

  const doCheckIn = async () => {
    setBusy(true);
    let coords: { lat: number; lng: number } | undefined;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      }
    } catch {
      // Location is optional — check-in still records the time.
    }
    checkIn(project.id, booking.id, a.id, { coords, note: coords ? 'Location confirmed' : 'Checked in without location' });
    setBusy(false);
    triggerHaptic('success');
    toast('Checked in — have a great shift!', 'location');
  };

  const addProofPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!res.canceled && res.assets[0]) setProof((p) => `${p}${p ? '\n' : ''}Photo: ${res.assets[0].fileName ?? 'photo'} attached`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={`${a.role} · ${project.title}`} subtitle={booking.providerName} right={<StatusPill status={a.status} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Card style={[styles.hero, { borderColor: onSite ? t.c.success : t.c.primary }]}>
          <Ionicons name={onSite ? 'radio' : a.status === 'COMPLETED' ? 'checkmark-done-circle' : 'calendar'} size={30} color={onSite ? t.c.success : t.c.primary} />
          <View style={{ flex: 1 }}>
            <Text size={18} weight="bold" color={t.c.textStrong}>
              {a.status === 'COMPLETED' ? 'Job completed' : onSite ? 'You’re on site' : days === 0 ? 'Today' : days > 0 ? `In ${days} days` : 'Past job'}
            </Text>
            <Text size={13} color={t.c.muted}>
              {formatLongDate(a.date)} · report {formatClock(a.startTime)}–{formatClock(a.endTime)}
            </Text>
            {a.checkedInAt && (
              <Text size={12} color={t.c.success}>
                In {formatTime(a.checkedInAt)}
                {a.checkedOutAt ? ` · out ${formatTime(a.checkedOutAt)}` : ''}
                {a.lateMinutes ? ` · ${a.lateMinutes} min late` : ''}
              </Text>
            )}
          </View>
        </Card>

        {a.status === 'ASSIGNED' && (
          <View style={styles.row}>
            <KButton label="Can’t make it" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => setCantOpen(true)} />
            <KButton label="Confirm I’ll be there" icon="checkmark" style={{ flex: 1.5 }} onPress={() => { setStatus(project.id, booking.id, a.id, 'CONFIRMED'); toast('Confirmed'); }} />
          </View>
        )}
        {a.status === 'CONFIRMED' && (
          <>
            <KButton label={days <= 0 ? 'Check in on site' : `Check-in opens ${formatLongDate(a.date)}`} icon="location" size="lg" disabled={days > 0} loading={busy} onPress={doCheckIn} />
            {days > 0 && <KButton label="Can’t make it" variant="ghost" size="sm" onPress={() => setCantOpen(true)} />}
          </>
        )}
        {a.status === 'CHECKED_IN' && <KButton label="Start work" icon="play" size="lg" onPress={() => setStatus(project.id, booking.id, a.id, 'IN_PROGRESS')} />}
        {onSite && (
          <View style={styles.row}>
            <KButton label="Report issue" icon="warning-outline" variant="danger" size="sm" style={{ flex: 1 }} onPress={() => setIssueOpen(true)} />
            <KButton label="Finish & check out" icon="log-out-outline" variant="success" size="sm" style={{ flex: 1.4 }} onPress={() => setOutOpen(true)} />
          </View>
        )}

        <Card style={{ gap: 4 }}>
          <KeyValue label="Pay" value={formatMoney(a.pay)} strong />
          <KeyValue label="Payout" value={payout ? `${payout.status.toLowerCase()}${payout.paidAt ? ` · ${formatLongDate(payout.paidAt)}` : ''}` : a.status === 'COMPLETED' ? 'Awaiting confirmation' : 'After the event'} />
          <KeyValue label="Function" value={`${event?.name ?? '—'} · ${event?.guests ?? project.guests} guests`} />
          <KeyValue label="Venue" value={event?.venue ?? project.city} />
          <KeyValue label="Booked by" value={booking.providerName} />
        </Card>
        <View style={styles.row}>
          <KButton label="Directions" icon="navigate-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event?.venue ?? ''} ${project.city}`)}`)} />
          {thread && <KButton label="Team chat" icon="chatbubbles-outline" variant="secondary" size="sm" style={{ flex: 1 }} onPress={() => router.push({ pathname: '/freelancer/inbox/[id]', params: { id: thread.id } })} />}
        </View>

        {crew.length > 0 && (
          <Card style={{ gap: 8 }}>
            <SectionTitle title="Crew on this function" />
            {crew.map((c) => (
              <View key={c.id} style={styles.row}>
                <Avatar name={c.workerName} size={30} />
                <Text size={13} color={t.c.text} style={{ flex: 1 }}>
                  {c.workerName} · {c.role}
                </Text>
                <StatusPill status={c.status} />
              </View>
            ))}
          </Card>
        )}

        {event && (
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
              reportIncident(project.id, { eventId: event?.id ?? project.events[0].id, title: issue.trim(), severity, reportedBy: `${account.name} (${a.role})` });
              setIssue('');
              setIssueOpen(false);
              toast('Issue reported to Vivah ops', 'warning');
            }}
          />
        </View>
      </Sheet>
      <Sheet visible={outOpen} onClose={() => setOutOpen(false)} title="Check out">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Text size={13} color={t.c.muted}>
            Add completion proof (files handed over, card numbers, notes). The organiser confirms and your payout is released.
          </Text>
          <KField placeholder="e.g. 2 cards (1,240 RAW) handed to Prakash at 21:10" value={proof} onChangeText={setProof} multiline />
          <KButton label="Attach photo" icon="camera-outline" variant="ghost" size="sm" onPress={addProofPhoto} />
          <KButton
            label="Check out & request payout"
            variant="success"
            icon="wallet"
            onPress={() => {
              checkOut(project.id, booking.id, a.id, proof.trim() || undefined);
              setOutOpen(false);
              triggerHaptic('success');
              toast('Checked out — payout requested', 'wallet');
            }}
          />
        </View>
      </Sheet>
      <Sheet visible={cantOpen} onClose={() => setCantOpen(false)} title="Can’t make it?">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <Text size={13} color={t.c.muted}>
            We’ll immediately start an emergency replacement so the couple isn’t affected. Frequent cancellations lower your reliability score.
          </Text>
          <ChoiceChips options={['Sick', 'Family emergency', 'Double-booked', 'Transport issue']} selected={[reason]} onToggle={setReason} />
          <KButton
            label="Release this job"
            variant="danger"
            disabled={!reason}
            onPress={() =>
              confirm('Release this job?', 'An emergency gig will go out to other crew.', 'Release', () => {
                startEmergency(project.id, booking.id, a.id, `${account.name}: ${reason}`);
                setCantOpen(false);
                toast('Released — Vivah is finding a replacement');
                router.back();
              })
            }
          />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
