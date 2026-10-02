import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius, shadows } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';
import type { Booking, BookingStatus } from '@/types';
import { formatMoney, formatLongDate, formatShortDate } from '@/utils/format';
import { confirm } from '@/utils/confirm';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const STATUS: Record<BookingStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Awaiting response', color: colors.warning, bg: `${colors.warning}14` },
  confirmed: { label: 'Confirmed', color: colors.success, bg: `${colors.success}14` },
  cancelled: { label: 'Cancelled', color: colors.danger, bg: `${colors.danger}14` },
};

type Filter = 'all' | Booking['kind'];

function BookingCard({ booking }: { booking: Booking }) {
  const setStatus = useAppStore((s) => s.setBookingStatus);
  const status = STATUS[booking.status];
  const open = () => {
    if (booking.kind === 'venue') router.push({ pathname: '/venue/[id]', params: { id: booking.refId } });
    else if (booking.kind === 'vendor') router.push({ pathname: '/vendor/[id]', params: { id: booking.refId } });
    else router.navigate('/genie');
  };

  return (
    <View style={[styles.card, shadows.card]}>
      <View style={styles.cardTop}>
        {booking.image ? (
          <Image source={photos[booking.image]} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.genieIcon]}>
            <Ionicons name="clipboard-outline" size={26} color={colors.textMuted} />
          </View>
        )}
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={16} weight="semibold" color={colors.heading} numberOfLines={1}>
            {booking.title}
          </Text>
          <Text size={13} color={colors.textMuted} numberOfLines={1}>
            {booking.subtitle}
          </Text>
          <View style={[styles.status, { backgroundColor: status.bg }]}>
            <Text size={11} weight="bold" color={status.color}>
              {status.label}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.meta}>
        {booking.eventDate && (
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
            <Text size={13} color={colors.textBody}>
              {formatLongDate(booking.eventDate)}
            </Text>
          </View>
        )}
        {!!booking.guests && (
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={15} color={colors.textMuted} />
            <Text size={13} color={colors.textBody}>
              {booking.guests} guests
            </Text>
          </View>
        )}
        {!!booking.amount && (
          <View style={styles.metaItem}>
            <Ionicons name="receipt-outline" size={15} color={colors.textMuted} />
            <Text size={13} color={colors.textBody}>
              Paid {formatMoney(booking.amount)}
            </Text>
          </View>
        )}
        <Text size={12} color={colors.textSubtle}>
          Requested {formatShortDate(booking.createdAt)}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button label="View" size="sm" variant="outline" onPress={open} style={{ flex: 1 }} />
        {booking.status !== 'cancelled' && booking.kind !== 'genie' && (
          <Button
            label="Cancel request"
            size="sm"
            variant="ghost"
            color={colors.danger}
            onPress={() =>
              confirm('Cancel request?', `Your enquiry with ${booking.title} will be withdrawn.`, 'Cancel request', () => setStatus(booking.id, 'cancelled'))
            }
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const bookings = useAppStore((s) => s.bookings);
  const [filter, setFilter] = useState<Filter>('all');
  const list = filter === 'all' ? bookings : bookings.filter((b) => b.kind === filter);

  return (
    <View style={styles.root}>
      <ScreenHeader title="My Bookings" />
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {(['all', 'venue', 'vendor', 'genie'] as Filter[]).map((f) => (
            <Chip key={f} label={f === 'all' ? 'All' : f === 'genie' ? 'Planner packages' : `${f[0].toUpperCase()}${f.slice(1)}s`} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={list}
        keyExtractor={(b) => b.id}
        contentContainerStyle={[styles.list, !list.length && { flexGrow: 1, justifyContent: 'center' }]}
        renderItem={({ item }) => <BookingCard booking={item} />}
        ListEmptyComponent={
          <EmptyState
            icon="calendar-outline"
            title="No bookings yet"
            message="Check availability with venues or send enquiries to vendors — they'll all be tracked here."
            actionLabel="Explore venues"
            onAction={() => router.navigate('/venues')}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  filters: { paddingHorizontal: GUTTER, paddingVertical: 12, gap: 8 },
  list: { padding: GUTTER, paddingTop: 4, gap: 14 },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  image: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.bgMuted },
  genieIcon: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bgMuted },
  status: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  meta: { gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actions: { flexDirection: 'row', gap: 10 },
});
