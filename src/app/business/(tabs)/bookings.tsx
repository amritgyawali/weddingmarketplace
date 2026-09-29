import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, View } from 'react-native';

import { EmptyBlock, RoleHeader, Segmented } from '@/components/kit';
import { BookingCard } from '@/components/work/Bookings';
import { useLayout } from '@/hooks/useLayout';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatMoneyCompact } from '@/utils/format';

type Filter = 'upcoming' | 'live' | 'completed' | 'cancelled';

/** Every booking this business holds, across Vivah-managed and direct weddings. */
export default function BookingsTab() {
  const t = useRoleTheme();
  const { columns } = useLayout();
  const account = useAccount();
  const { bookings } = useVendorWorkspace(account);
  const [filter, setFilter] = useState<Filter>('upcoming');
  const test = (f: Filter, s: string) => (f === 'upcoming' ? s === 'CONFIRMED' || s === 'HELD' || s === 'PROPOSED' : f === 'live' ? s === 'IN_PROGRESS' : f === 'completed' ? s === 'COMPLETED' : s === 'CANCELLED');
  const list = bookings.filter((b) => test(filter, b.booking.status)).sort((a, b) => a.project.weddingDate.localeCompare(b.project.weddingDate));
  const counts = Object.fromEntries((['upcoming', 'live', 'completed', 'cancelled'] as Filter[]).map((f) => [f, bookings.filter((b) => test(f, b.booking.status)).length])) as Record<Filter, number>;
  const value = bookings.filter((b) => b.booking.status !== 'CANCELLED').reduce((s, b) => s + b.booking.providerPayable, 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="BOOKINGS" title="Bookings" subtitle={`${bookings.length} total · ${formatMoneyCompact(value)} to you`} />
      <View style={{ paddingTop: 14 }}>
        <Segmented
          options={[
            { id: 'upcoming', label: 'Upcoming' },
            { id: 'live', label: 'Live' },
            { id: 'completed', label: 'Completed' },
            { id: 'cancelled', label: 'Cancelled' },
          ]}
          value={filter}
          onChange={setFilter}
          counts={counts}
        />
      </View>
      <FlatList
        key={columns}
        data={list}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? { gap: 12 } : undefined}
        keyExtractor={(b) => b.booking.id}
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyBlock icon="briefcase-outline" title="No bookings here" message="Accepted quotations and Vivah booking requests appear here with crew, deliverables and payouts." />}
        renderItem={({ item }) => (
          <View style={{ flex: 1 }}>
            <BookingCard project={item.project} booking={item.booking} mode="vendor" onPress={() => router.push({ pathname: '/business/booking/[id]', params: { id: item.booking.id } })} />
          </View>
        )}
      />
    </View>
  );
}
