import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, KButton, KField, ProgressBar, StatusPill } from '@/components/kit';
import { triggerHaptic } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { findService, serviceName } from '@/data/services';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Deliverable, Project, ServiceBooking } from '@/types/platform';
import { daysUntil, formatMoney, formatShortDate, relativeDay } from '@/utils/format';
import { openSafeLink } from '@/utils/links';

/** One provider booking, as the couple sees it: the provider, the functions and the agreed price. */
export function BookingCard({ project, booking, onPress }: { project: Project; booking: ServiceBooking; onPress?: () => void }) {
  const t = useRoleTheme();
  const def = findService(booking.serviceId);
  const events = project.events.filter((e) => booking.eventIds.includes(e.id));
  const delivered = booking.deliverables.filter((d) => d.status === 'DELIVERED' || d.status === 'APPROVED').length;
  const status = booking.providerResponse === 'pending' && booking.status !== 'CANCELLED' ? 'pending' : booking.status;
  return (
    <Card onPress={onPress} style={{ gap: 10 }} accessibilityLabel={`${serviceName(booking.serviceId)} by ${booking.providerName}`}>
      <View style={styles.row}>
        <View style={[styles.icon, { borderWidth: 1, borderColor: t.c.border }]}>
          <Ionicons name={(def?.icon ?? 'briefcase-outline') as never} size={20} color={t.c.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size={12} weight="medium" color={t.c.muted}>
            {serviceName(booking.serviceId)}
          </Text>
          <Text size={15} weight="bold" color={t.c.textStrong} numberOfLines={1}>
            {booking.providerName}
          </Text>
          <Text size={12} color={t.c.muted} numberOfLines={1}>
            {events.map((e) => `${e.name}${e.date ? ` ${formatShortDate(e.date).slice(4)}` : ''}`).join(' · ') || 'Events TBC'}
          </Text>
        </View>
        <StatusPill status={status} label={status === 'pending' ? 'Awaiting provider' : undefined} />
      </View>
      <View style={styles.moneyRow}>
        <View style={{ flex: 1 }}>
          <Text size={11} color={t.c.muted}>
            Price
          </Text>
          <Text size={14} weight="bold" color={t.c.textStrong}>
            {formatMoney(booking.agreedPrice)}
          </Text>
        </View>
      </View>
      {booking.deliverables.length > 0 && (
        <View style={styles.row}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text size={11} color={t.c.muted}>
              Deliverables {delivered}/{booking.deliverables.length}
            </Text>
            <ProgressBar value={booking.deliverables.reduce((s, d) => s + d.progress, 0) / booking.deliverables.length} color={t.c.info} />
          </View>
        </View>
      )}
    </Card>
  );
}

// Deliverables
function DeliverableRow({ project, booking, d }: { project: Project; booking: ServiceBooking; d: Deliverable }) {
  const t = useRoleTheme();
  const update = useDb((s) => s.updateDeliverable);
  const [note, setNote] = useState('');
  const overdue = d.status !== 'DELIVERED' && d.status !== 'APPROVED' && daysUntil(d.due) < 0;

  return (
    <View style={[styles.deliverable, { borderColor: overdue ? t.c.danger : t.c.border }]}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text size={14} weight="semibold" color={t.c.textStrong}>
            {d.title}
            {d.quantity ? ` · ${d.quantity} ${d.unit ?? ''}` : ''}
          </Text>
          <Text size={12} color={overdue ? t.c.danger : t.c.muted}>
            Due {formatShortDate(d.due)} ({relativeDay(d.due)}){d.revisions ? ` · revision ${d.revisions}/${d.revisionLimit}` : ''}
          </Text>
        </View>
        <StatusPill status={d.status} />
      </View>
      <ProgressBar value={d.progress} color={d.status === 'REVISION_REQUESTED' ? t.c.warning : t.c.success} />
      {!!d.link && (
        <Pressable onPress={() => openSafeLink(d.link)} style={styles.inline}>
          <Ionicons name="link-outline" size={14} color={t.c.primary} />
          <Text size={12} weight="semibold" color={t.c.primary} numberOfLines={1}>
            Open delivery folder
          </Text>
        </Pressable>
      )}
      {d.status === 'READY_FOR_REVIEW' && (
        <View style={{ gap: 8 }}>
          <KField placeholder="What should change? (needed to request changes)" value={note} onChangeText={setNote} multiline maxLength={500} />
          <View style={styles.actionsRow}>
            <KButton
              label="Request changes"
              size="sm"
              variant="secondary"
              missing={d.revisions >= d.revisionLimit ? `All ${d.revisionLimit} revisions have been used` : !note.trim() && 'Write what should change first'}
              onPress={() => {
                update(project.id, booking.id, d.id, { status: 'REVISION_REQUESTED' }, note.trim());
                toast('Changes requested. The provider will send an update', 'create');
              }}
              style={{ flex: 1 }}
            />
            <KButton
              label="Approve"
              size="sm"
              icon="checkmark"
              onPress={() => {
                update(project.id, booking.id, d.id, { status: 'APPROVED' }, note.trim() || undefined);
                triggerHaptic('success');
                toast(`${d.title} approved`, 'checkmark-circle');
              }}
              style={{ flex: 1 }}
            />
          </View>
          {d.revisions >= d.revisionLimit && (
            <Text size={11} color={t.c.muted}>
              Revision limit reached — contact your coordinator for more changes.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/** The booking's deliverables, with approve and request-changes for the ones ready for review. */
export function DeliverablesPanel({ project, booking }: { project: Project; booking: ServiceBooking }) {
  if (!booking.deliverables.length) return null;
  return (
    <View style={{ gap: 10 }}>
      {booking.deliverables.map((d) => (
        <DeliverableRow key={d.id} project={project} booking={booking} d={d} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  icon: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  moneyRow: { flexDirection: 'row', gap: 10 },
  actionsRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  deliverable: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 8 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
