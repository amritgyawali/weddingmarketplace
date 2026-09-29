import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar, Card, EmptyBlock, KField, ListRow, StackHeader, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { quoteTotals } from '@/services/quotes';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatMoney, formatPhone, formatShortDate } from '@/utils/format';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  city: string;
  leads: number;
  quotes: number;
  bookings: number;
  value: number;
  lastAt: string;
}

/** Customer CRM: everyone who enquired, got a quote or booked — with full history. */
export default function Customers() {
  const t = useRoleTheme();
  const account = useAccount();
  const { leads, quotes, bookings } = useVendorWorkspace(account);
  const reviews = useDb((s) => s.reviews);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState<Customer | null>(null);

  const map = new Map<string, Customer>();
  const touch = (id: string, name: string, city: string, at: string, patch: Partial<Customer>, phone?: string) => {
    const c = map.get(id) ?? { id, name, phone, city, leads: 0, quotes: 0, bookings: 0, value: 0, lastAt: at };
    map.set(id, { ...c, ...patch, leads: c.leads + (patch.leads ?? 0), quotes: c.quotes + (patch.quotes ?? 0), bookings: c.bookings + (patch.bookings ?? 0), value: c.value + (patch.value ?? 0), phone: c.phone ?? phone, lastAt: at > c.lastAt ? at : c.lastAt });
  };
  leads.forEach((l) => touch(l.customerId, l.customerName, l.city, l.createdAt, { leads: 1 }, l.customerPhone));
  quotes.forEach((q) => touch(q.customerId, q.customerName, q.city, q.updatedAt, { quotes: 1 }));
  bookings.forEach(({ project, booking }) => touch(project.customerId, project.customerName, project.city, booking.createdAt, { bookings: 1, value: booking.providerPayable }, project.managedBy === 'self' ? project.customerPhone : undefined));
  const q = query.trim().toLowerCase();
  const list = [...map.values()].filter((c) => !q || c.name.toLowerCase().includes(q)).sort((a, b) => b.lastAt.localeCompare(a.lastAt));

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Customers" subtitle={`${list.length} couples & families`} />
      <FlatList
        data={list}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        ListHeaderComponent={<KField placeholder="Search customers" value={query} onChangeText={setQuery} />}
        ListEmptyComponent={<EmptyBlock icon="people-outline" title="No customers yet" />}
        renderItem={({ item }) => (
          <Card onPress={() => setOpen(item)} style={styles.row}>
            <Avatar name={item.name} />
            <View style={{ flex: 1 }}>
              <Text size={15} weight="bold" color={t.c.textStrong}>
                {item.name}
              </Text>
              <Text size={12} color={t.c.muted}>
                {item.leads} leads · {item.quotes} quotes · {item.bookings} bookings · {item.city}
              </Text>
            </View>
            {item.value > 0 && (
              <Text size={14} weight="bold" color={t.c.success}>
                {formatMoney(item.value)}
              </Text>
            )}
          </Card>
        )}
      />
      <Sheet visible={!!open} onClose={() => setOpen(null)} title={open?.name}>
        {open && (
          <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 12 }}>
            {open.phone && (
              <Text size={13} color={t.c.muted}>
                {formatPhone(open.phone)} · {open.city}
              </Text>
            )}
            {leads.filter((l) => l.customerId === open.id).map((l) => (
              <ListRow key={l.id} icon="flash-outline" title={`Lead · ${l.functions.join(', ')}`} subtitle={formatShortDate(l.createdAt)} trailing={<StatusPill status={l.status} />} onPress={() => { setOpen(null); router.push({ pathname: '/business/lead/[id]', params: { id: l.id } }); }} />
            ))}
            {quotes.filter((x) => x.customerId === open.id).map((x) => (
              <ListRow key={x.id} icon="document-text-outline" title={`${x.number} · ${formatMoney(quoteTotals(x).total)}`} subtitle={`v${x.version}`} trailing={<StatusPill status={x.status} />} onPress={() => { setOpen(null); router.push({ pathname: '/business/quote/[id]', params: { id: x.id } }); }} />
            ))}
            {bookings.filter((b) => b.project.customerId === open.id).map(({ project, booking }) => (
              <ListRow key={booking.id} icon="briefcase-outline" title={`Booking · ${project.title}`} subtitle={formatShortDate(project.weddingDate)} trailing={<StatusPill status={booking.status} />} onPress={() => { setOpen(null); router.push({ pathname: '/business/booking/[id]', params: { id: booking.id } }); }} />
            ))}
            {reviews.filter((r) => r.authorId === open.id && r.targetId === account.listingId).map((r) => (
              <Text key={r.id} size={13} color={t.c.text}>
                ★ {r.overall} — “{r.text}”
              </Text>
            ))}
          </ScrollView>
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
