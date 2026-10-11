import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { SUPPORT_DESK_STATUS_LABEL, SUPPORT_STATUS_LABEL, SUPPORT_TOPIC_LABEL, supportHref } from '@/data/support';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SupportTicket } from '@/types/platform';
import { timeAgo } from '@/utils/format';

/** The status a role sees: the person reads "Waiting for your reply", staff read "Waiting on customer". */
export function TicketStatus({ ticket, desk }: { ticket: SupportTicket; desk?: boolean }) {
  const tone = ticket.status === 'waiting' ? (desk ? 'pending' : 'due') : ticket.status === 'open' ? (desk ? 'new' : 'pending') : ticket.status;
  return <StatusPill status={tone} label={(desk ? SUPPORT_DESK_STATUS_LABEL : SUPPORT_STATUS_LABEL)[ticket.status]} />;
}

/** One request in a list: subject, code, topic, last message and when. */
export function TicketRow({ ticket, desk, last }: { ticket: SupportTicket; desk?: boolean; last?: boolean }) {
  const t = useRoleTheme();
  const visible = ticket.messages.filter((m) => desk || !m.internal);
  const latest = visible[visible.length - 1];
  const needsYou = desk ? ticket.status === 'open' : ticket.status === 'waiting';
  return (
    <Pressable
      onPress={() => router.push((desk ? `/platform/support/${ticket.id}` : supportHref(ticket.role, ticket.id)) as Href)}
      accessibilityRole="button"
      accessibilityLabel={`${ticket.subject}, ${(desk ? SUPPORT_DESK_STATUS_LABEL : SUPPORT_STATUS_LABEL)[ticket.status]}`}
      style={({ pressed }) => [styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.c.border }, pressed && { backgroundColor: t.c.surfaceAlt }]}>
      <View style={[styles.rail, { backgroundColor: needsYou ? t.c.primary : 'transparent' }]} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.top}>
          <Text size={15} weight={needsYou ? 'bold' : 'semibold'} color={t.c.textStrong} numberOfLines={1} style={{ flex: 1 }} raw>
            {ticket.subject}
          </Text>
          <Text size={12} color={t.c.muted}>
            {timeAgo(ticket.updatedAt)}
          </Text>
        </View>
        {latest && (
          <Text size={13} color={t.c.muted} numberOfLines={2} raw>
            {latest.authorId === ticket.accountId ? '' : `${latest.authorName}: `}
            {latest.body}
          </Text>
        )}
        <View style={styles.meta}>
          <TicketStatus ticket={ticket} desk={desk} />
          <Text size={12} color={t.c.muted} raw>
            {ticket.code}
          </Text>
          <Text size={12} color={t.c.muted}>
            {SUPPORT_TOPIC_LABEL[ticket.topic]}
          </Text>
          {desk && ticket.priority !== 'normal' && <StatusPill status={ticket.priority === 'urgent' ? 'urgent' : 'high'} label={ticket.priority === 'urgent' ? 'Urgent' : 'Soon'} />}
          {desk && (
            <Text size={12} color={t.c.muted} raw>
              {ticket.accountName}
            </Text>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={t.c.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 14 },
  rail: { width: 3, alignSelf: 'stretch', borderTopRightRadius: 2, borderBottomRightRadius: 2 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
