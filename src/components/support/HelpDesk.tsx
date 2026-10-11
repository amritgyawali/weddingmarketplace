import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KField, Segmented, StackHeader, StatTile } from '@/components/kit';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { Text } from '@/components/ui/Text';
import { isOpenTicket } from '@/data/support';
import { useLayout } from '@/hooks/useLayout';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SupportTicket } from '@/types/platform';

import { TicketRow } from './parts';

type Filter = 'new' | 'mine' | 'waiting' | 'all' | 'done';

const URGENCY = { urgent: 0, high: 1, normal: 2 } as const;

/** Unanswered and urgent first, then the oldest wait. */
const queueOrder = (a: SupportTicket, b: SupportTicket) => URGENCY[a.priority] - URGENCY[b.priority] || a.updatedAt.localeCompare(b.updatedAt);

/** The staff queue of help requests from every role (Platform → Help desk). */
export function HelpDesk() {
  const t = useRoleTheme();
  const me = useAccount();
  const { wide } = useLayout();
  const tickets = useDb((s) => s.supportTickets);
  const [filter, setFilter] = useState<Filter>('new');
  const [query, setQuery] = useState('');
  const open = tickets.filter((x) => isOpenTicket(x.status));
  const counts: Record<Filter, number> = {
    new: open.filter((x) => x.status === 'open').length,
    mine: open.filter((x) => x.assignedTo === me.id).length,
    waiting: open.filter((x) => x.status === 'waiting').length,
    all: open.length,
    done: tickets.length - open.length,
  };
  const q = query.trim().toLowerCase();
  const list = tickets
    .filter((x) =>
      filter === 'new' ? x.status === 'open' : filter === 'mine' ? x.assignedTo === me.id && isOpenTicket(x.status) : filter === 'waiting' ? x.status === 'waiting' : filter === 'all' ? isOpenTicket(x.status) : !isOpenTicket(x.status),
    )
    .filter((x) => !q || `${x.code} ${x.subject} ${x.accountName} ${x.messages.map((m) => m.body).join(' ')}`.toLowerCase().includes(q))
    .sort(filter === 'done' ? (a, b) => b.updatedAt.localeCompare(a.updatedAt) : queueOrder);
  const rated = tickets.filter((x) => x.rating);
  const average = rated.length ? (rated.reduce((sum, x) => sum + (x.rating ?? 0), 0) / rated.length).toFixed(1) : '–';

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Help desk" subtitle="Requests from couples, businesses and freelancers" />
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]} keyboardShouldPersistTaps="handled">
        <View style={styles.stats}>
          <StatTile label="New" value={String(counts.new)} alert={counts.new > 0} style={styles.stat} />
          <StatTile label="Urgent" value={String(open.filter((x) => x.priority === 'urgent').length)} alert={open.some((x) => x.priority === 'urgent')} style={styles.stat} />
          <StatTile label="Yours" value={String(counts.mine)} style={styles.stat} />
          <StatTile label="Rating" value={average} sub={rated.length ? `${rated.length} rated` : undefined} style={styles.stat} />
        </View>
        <KField value={query} onChangeText={setQuery} placeholder="Search code, name or words" />
        <Segmented<Filter>
          options={[
            { id: 'new', label: 'New' },
            { id: 'mine', label: 'Mine' },
            { id: 'waiting', label: 'Waiting' },
            { id: 'all', label: 'All open' },
            { id: 'done', label: 'Solved' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
        {list.length === 0 ? (
          <Card>
            <EmptyBlock icon="checkmark-done-outline" title={filter === 'new' ? 'No new requests' : 'Nothing here'} message={filter === 'new' ? 'Everyone has an answer. New requests show here and notify the team.' : 'Try another filter or search.'} />
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {list.map((ticket, i) => (
              <TicketRow key={ticket.id} ticket={ticket} desk last={i === list.length - 1} />
            ))}
          </Card>
        )}
        <Text size={12} color={t.c.muted}>
          Answer normal requests within two working hours, Soon the same day, and call Urgent ones at once.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 12, paddingBottom: 60 },
  bodyWide: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingTop: 24 },
  stats: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  stat: { flexGrow: 1, flexBasis: '22%', minWidth: 80 },
});
