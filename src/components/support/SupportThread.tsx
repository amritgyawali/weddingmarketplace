import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, Card, ChoiceChips, EmptyBlock, KButton, KField, KeyValue, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { Text } from '@/components/ui/Text';
import { toastError } from '@/components/ui/Toast';
import { isOpenTicket, SUPPORT_DESK_STATUS_LABEL, SUPPORT_LIMITS, SUPPORT_PRIORITIES, SUPPORT_TOPIC_LABEL, supportHref } from '@/data/support';
import { useLayout } from '@/hooks/useLayout';
import { useDraft } from '@/store/drafts';
import { useDb } from '@/store/useDb';
import { useAccount, useSession } from '@/store/useSession';
import { ROLE_THEMES } from '@/theme/roles';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SupportMessage, SupportPriority, SupportTicket, SupportTicketStatus } from '@/types/platform';
import { formatPhone, formatTime, formatShortDate } from '@/utils/format';

import { TicketStatus } from './parts';

function Bubble({ m, mine, desk }: { m: SupportMessage; mine: boolean; desk: boolean }) {
  const t = useRoleTheme();
  const bot = m.authorId === 'system';
  if (bot)
    return (
      <View style={styles.botRow}>
        <Ionicons name="checkmark-done-outline" size={14} color={t.c.muted} />
        <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
          {m.body}
        </Text>
      </View>
    );
  const fill = m.internal ? t.c.surfaceAlt : mine ? t.c.primary : t.c.surface;
  const ink = mine && !m.internal ? t.c.onPrimary : t.c.textStrong;
  return (
    <View style={[styles.bubbleRow, mine ? { justifyContent: 'flex-end' } : null]}>
      {!mine && <Avatar name={m.authorName} size={30} />}
      <View style={[styles.bubble, { backgroundColor: fill, borderColor: m.internal ? t.c.accent : mine ? fill : t.c.border }, m.internal && styles.internal, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {(!mine || desk) && (
          <Text size={12} weight="semibold" color={mine && !m.internal ? t.c.onPrimary : t.c.muted} raw>
            {m.authorName}
            {m.authorRole !== 'platform' && desk ? ` · ${ROLE_THEMES[m.authorRole].label}` : ''}
            {m.internal ? ' · ' : ''}
            {m.internal && <Text size={12} weight="semibold" color={t.c.accentText}>Internal note</Text>}
          </Text>
        )}
        <Text size={15} color={ink} lineHeight={22} raw selectable>
          {m.body}
        </Text>
        <Text size={11} color={mine && !m.internal ? t.c.onPrimary : t.c.muted} style={{ alignSelf: 'flex-end', opacity: 0.85 }}>
          {formatShortDate(m.at.slice(0, 10))} · {formatTime(m.at)}
        </Text>
      </View>
    </View>
  );
}

function Stars({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useRoleTheme();
  return (
    <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel="Rate the help">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={6} accessibilityRole="radio" accessibilityState={{ checked: value === n }} accessibilityLabel={`${n} of 5`}>
          <Ionicons name={n <= value ? 'star' : 'star-outline'} size={30} color={n <= value ? t.c.accent : t.c.subtle} />
        </Pressable>
      ))}
    </View>
  );
}

/** Owner: rate the help once it is solved. */
function RateCard({ ticket }: { ticket: SupportTicket }) {
  const t = useRoleTheme();
  const rate = useDb((s) => s.rateSupportTicket);
  const [stars, setStars] = useState(ticket.rating ?? 0);
  const [note, setNote] = useState(ticket.ratingNote ?? '');
  if (ticket.rating)
    return (
      <Card style={{ gap: 6 }}>
        <Text size={14} weight="semibold" color={t.c.textStrong}>
          Thank you for rating the help
        </Text>
        <Stars value={ticket.rating} onChange={() => {}} />
        {!!ticket.ratingNote && (
          <Text size={13} color={t.c.muted} raw>
            “{ticket.ratingNote}”
          </Text>
        )}
      </Card>
    );
  return (
    <Card style={{ gap: 10 }}>
      <Text size={15} weight="semibold" color={t.c.textStrong}>
        How did we do?
      </Text>
      <Stars value={stars} onChange={setStars} />
      <KField value={note} onChangeText={setNote} placeholder="Anything we could do better? (optional)" maxLength={300} />
      <KButton label="Send rating" size="sm" style={{ alignSelf: 'flex-start' }} missing={!stars && 'Pick one to five stars'} onPress={() => {
        const error = rate(ticket.id, stars, note);
        if (error) toastError(error);
      }} />
    </Card>
  );
}

/** Staff: status, priority and who is looking after it. */
function DeskPanel({ ticket }: { ticket: SupportTicket }) {
  const t = useRoleTheme();
  const me = useAccount();
  const accounts = useSession((s) => s.accounts);
  const setStatus = useDb((s) => s.setSupportTicketStatus);
  const assign = useDb((s) => s.assignSupportTicket);
  const customer = accounts.find((a) => a.id === ticket.accountId);
  const run = (error: string | null) => error && toastError(error);
  const statuses: SupportTicketStatus[] = ['open', 'in_progress', 'waiting', 'resolved', 'closed'];
  return (
    <Card style={{ gap: 12 }}>
      <KeyValue label="From" value={`${ticket.accountName} · ${ROLE_THEMES[ticket.role].label}`} />
      {!!customer?.phone && <KeyValue label="Phone" value={formatPhone(customer.phone)} />}
      {!!customer?.email && <KeyValue label="Email" value={customer.email} />}
      <KeyValue label="Topic" value={SUPPORT_TOPIC_LABEL[ticket.topic]} />
      <KeyValue label="Opened" value={`${formatShortDate(ticket.createdAt.slice(0, 10))} · ${formatTime(ticket.createdAt)}`} />
      {ticket.rating ? <KeyValue label="Rating" value={`${ticket.rating} of 5`} /> : null}
      <Text size={13} color={t.c.muted}>
        Looked after by
      </Text>
      <View style={styles.row}>
        <Text size={14} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }} raw>
          {ticket.assignedName ?? 'Nobody yet'}
        </Text>
        {ticket.assignedTo !== me.id ? (
          <KButton label="Assign to me" size="sm" variant="secondary" icon="person-add-outline" onPress={() => run(assign(ticket.id, me.id))} />
        ) : (
          <KButton label="Unassign" size="sm" variant="ghost" onPress={() => run(assign(ticket.id, null))} />
        )}
      </View>
      <Text size={13} color={t.c.muted}>
        Priority
      </Text>
      <ChoiceChips options={SUPPORT_PRIORITIES.map((p) => p.label)} selected={[SUPPORT_PRIORITIES.find((p) => p.id === ticket.priority)?.label ?? 'Normal']} onToggle={(label) => run(assign(ticket.id, ticket.assignedTo ?? null, (SUPPORT_PRIORITIES.find((p) => p.label === label)?.id ?? 'normal') as SupportPriority))} />
      <Text size={13} color={t.c.muted}>
        Status
      </Text>
      <ChoiceChips options={statuses.map((s) => SUPPORT_DESK_STATUS_LABEL[s])} selected={[SUPPORT_DESK_STATUS_LABEL[ticket.status]]} onToggle={(label) => run(setStatus(ticket.id, statuses.find((s) => SUPPORT_DESK_STATUS_LABEL[s] === label) ?? ticket.status))} />
      {ticket.projectId && (
        <KButton label="Open the project" size="sm" variant="secondary" icon="folder-open-outline" style={{ alignSelf: 'flex-start' }} onPress={() => router.push(`/platform/project/${ticket.projectId}` as Href)} />
      )}
    </Card>
  );
}

/**
 * One help request: the conversation, a reply box, and for the owner "mark
 * as solved" and a rating; for staff (`desk`) the status, priority, owner and
 * internal notes.
 */
export function SupportThread({ id, desk = false }: { id: string; desk?: boolean }) {
  const t = useRoleTheme();
  const me = useAccount();
  const { wide } = useLayout();
  const ticket = useDb((s) => s.supportTickets.find((x) => x.id === id));
  const reply = useDb((s) => s.replySupportTicket);
  const setStatus = useDb((s) => s.setSupportTicketStatus);
  const [text, setText, clearText] = useDraft(ticket ? `support-reply:${me.id}:${ticket.id}` : null, '');
  const [internal, setInternal] = useState(false);

  if (!ticket || (!desk && ticket.accountId !== me.id))
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Help request" />
        <EmptyBlock icon="chatbubbles-outline" title="Request not found" message="It may have been closed or opened from another account." action="All requests" onAction={() => router.replace(supportHref(me.role) as Href)} />
      </View>
    );

  const messages = ticket.messages.filter((m) => desk || !m.internal);
  const send = () => {
    const error = reply(ticket.id, text, { internal: desk && internal });
    if (error) {
      toastError(error);
      return;
    }
    clearText();
    setInternal(false);
  };
  const run = (error: string | null) => error && toastError(error);
  const solved = !isOpenTicket(ticket.status);

  const conversation = (
    <View style={{ gap: 12 }}>
      <Card style={{ gap: 6 }}>
        <Text serif size={19} weight="bold" color={t.c.textStrong} lineHeight={27} raw>
          {ticket.subject}
        </Text>
        <View style={styles.meta}>
          <TicketStatus ticket={ticket} desk={desk} />
          <Text size={12} color={t.c.muted} raw>
            {ticket.code}
          </Text>
          <Text size={12} color={t.c.muted}>
            {SUPPORT_TOPIC_LABEL[ticket.topic]}
          </Text>
          {ticket.priority !== 'normal' && <StatusPill status={ticket.priority === 'urgent' ? 'urgent' : 'high'} label={ticket.priority === 'urgent' ? 'Urgent' : 'Soon'} />}
        </View>
        {!desk && ticket.status === 'waiting' && (
          <Text size={13} color={t.c.primary} weight="semibold">
            The team asked you something. Reply below.
          </Text>
        )}
      </Card>
      {messages.map((m) => (
        <Bubble key={m.id} m={m} mine={desk ? m.authorRole === 'platform' : m.authorId === me.id} desk={desk} />
      ))}
      {ticket.status === 'closed' && !desk ? (
        <Card style={{ gap: 8 }}>
          <Text size={14} color={t.c.muted}>
            This request is closed. If you need more help, ask again and we’ll pick it up.
          </Text>
          <KButton label="New request" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => router.replace(`${supportHref(me.role)}/new` as Href)} />
        </Card>
      ) : (
        <Card style={{ gap: 10 }}>
          <KField
            value={text}
            onChangeText={setText}
            placeholder={desk ? (internal ? 'Note for the team (the customer won’t see it)' : 'Reply to the customer') : 'Write a reply'}
            multiline
            maxLength={SUPPORT_LIMITS.bodyMax}
          />
          <View style={styles.row}>
            {desk && (
              <Pressable onPress={() => setInternal((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: internal }} style={styles.check}>
                <Ionicons name={internal ? 'checkbox' : 'square-outline'} size={20} color={internal ? t.c.primary : t.c.muted} />
                <Text size={13} color={t.c.text}>
                  Internal note
                </Text>
              </Pressable>
            )}
            <View style={{ flex: 1 }} />
            <KButton label={desk && internal ? 'Add note' : 'Send'} icon="send" size="sm" missing={!text.trim() && 'Write a message first'} onPress={send} />
          </View>
        </Card>
      )}
      {!desk && !solved && (
        <KButton label="My problem is solved" variant="secondary" icon="checkmark-circle-outline" onPress={() => run(setStatus(ticket.id, 'resolved'))} />
      )}
      {!desk && ticket.status === 'resolved' && (
        <KButton label="I still need help" variant="ghost" icon="refresh-outline" onPress={() => run(setStatus(ticket.id, 'open'))} />
      )}
      {!desk && solved && <RateCard ticket={ticket} />}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={ticket.code} subtitle={desk ? ticket.accountName : 'Help request'} />
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]} keyboardShouldPersistTaps="handled">
        {desk && wide ? (
          <View style={styles.columns}>
            <View style={{ flex: 1.6 }}>{conversation}</View>
            <View style={{ flex: 1, gap: 12 }}>
              <SectionTitle title="Request" />
              <DeskPanel ticket={ticket} />
            </View>
          </View>
        ) : (
          <>
            {desk && <DeskPanel ticket={ticket} />}
            {conversation}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  bodyWide: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingTop: 24 },
  columns: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  botRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 6 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  bubble: { maxWidth: '84%', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, gap: 3 },
  bubbleMine: { borderBottomRightRadius: 4 },
  bubbleTheirs: { borderBottomLeftRadius: 4 },
  internal: { borderStyle: 'dashed' },
  stars: { flexDirection: 'row', gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
