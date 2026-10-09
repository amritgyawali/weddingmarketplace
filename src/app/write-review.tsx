import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, KField, StatusPill } from '@/components/kit';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { ReviewComposer } from '@/components/work/ReviewComposer';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import { findProvider, PROVIDERS } from '@/data/providers';
import { serviceName } from '@/data/services';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

interface Target {
  providerId: string;
  name: string;
  serviceId: string;
  bookingId?: string;
}

/** Category-specific reviews tied to real bookings (verified badge), with photos and moderation. */
export default function WriteReviewScreen() {
  const params = useLocalSearchParams<{ providerId?: string; bookingId?: string; name?: string }>();
  const account = useAccount();
  const { project } = useCustomerWorkspace(account.id);
  const reviews = useDb((s) => s.reviews);
  const submitReview = useDb((s) => s.submitReview);
  const [q, setQ] = useState(params.name ?? '');
  const [target, setTarget] = useState<Target | null>(() => {
    const b = project?.bookings.find((x) => x.id === params.bookingId);
    const p = findProvider(b?.providerId ?? params.providerId ?? '');
    return p ? { providerId: p.id, name: p.name, serviceId: p.serviceId, bookingId: b?.id } : null;
  });

  const mine = reviews.filter((r) => r.authorId === account.id);
  const reviewed = new Set(mine.map((r) => r.bookingId ?? r.targetId));
  const due = (project?.bookings ?? []).filter((b) => b.status !== 'CANCELLED' && !reviewed.has(b.id) && (b.status === 'COMPLETED' || b.eventIds.some((id) => project?.events.find((e) => e.id === id && e.date && e.date <= new Date().toISOString().slice(0, 10)))));
  const matches = q.trim().length >= 2 ? PROVIDERS.filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];

  if (target) {
    const booking = project?.bookings.find((b) => b.id === target.bookingId);
    // The booked events first, then the rest of the couple's dated events.
    const eventDates = (project?.events ?? [])
      .filter((e) => e.date && e.status !== 'cancelled')
      .sort((a, b) => Number(!booking?.eventIds.includes(a.id)) - Number(!booking?.eventIds.includes(b.id)) || a.date!.localeCompare(b.date!))
      .map((e) => ({ label: e.name, date: e.date! }));
    return (
      <View style={styles.root}>
        <ScreenHeader title="Write a review" subtitle={`${target.name} · ${serviceName(target.serviceId)}`} />
        <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 12 }}>
          <ReviewComposer
            serviceId={target.serviceId}
            targetName={target.name}
            eventDates={eventDates}
            draftKey={`review:${account.id}:${target.bookingId ?? target.providerId}`}
            onSubmit={(r) => {
              const saved = submitReview({
                targetKind: 'provider',
                targetId: target.providerId,
                targetName: target.name,
                projectId: target.bookingId ? project?.id : undefined,
                bookingId: target.bookingId,
                authorId: account.id,
                authorName: account.name,
                authorRole: 'customer',
                overall: r.overall,
                criteria: r.criteria,
                text: r.text,
                photos: [],
                photoUris: r.photoUris,
                eventDate: r.eventDate,
              });
              toast(saved.status === 'published' ? 'Your review is live. Thank you!' : 'Thanks! Your review is with our team for a quick check', 'star');
              router.back();
            }}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader title="Write a review" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text size={15} color={colors.textBody} lineHeight={22}>
          Your review helps couples across Nepal hire their wedding team with confidence. Reviews of vendors you booked through Vivah get a ✓ Verified badge.
        </Text>
        {due.length > 0 && (
          <>
            <Text size={16} weight="bold" color={colors.heading}>
              Waiting for your review
            </Text>
            {due.map((b) => {
              const p = findProvider(b.providerId);
              return (
                <Card key={b.id} onPress={() => setTarget({ providerId: b.providerId, name: b.providerName, serviceId: b.serviceId, bookingId: b.id })} style={styles.row}>
                  {p && <Photo source={photos[p.image]} style={styles.thumb} contentFit="cover" />}
                  <View style={{ flex: 1 }}>
                    <Text size={15} weight="bold" color={colors.textStrong}>
                      {b.providerName}
                    </Text>
                    <Text size={12} color={colors.textMuted}>
                      {serviceName(b.serviceId)} · verified booking
                    </Text>
                  </View>
                  <Ionicons name="star-outline" size={22} color={colors.primary} />
                </Card>
              );
            })}
          </>
        )}
        <Text size={16} weight="bold" color={colors.heading}>
          Review another vendor
        </Text>
        <KField placeholder="Search venue or vendor name" value={q} onChangeText={setQ} />
        {matches.map((p) => (
          <Card key={p.id} onPress={() => setTarget({ providerId: p.id, name: p.name, serviceId: p.serviceId })} style={styles.row}>
            <Photo source={photos[p.image]} style={styles.thumb} contentFit="cover" />
            <View style={{ flex: 1 }}>
              <Text size={14} weight="semibold" color={colors.textStrong}>
                {p.name}
              </Text>
              <Text size={12} color={colors.textMuted}>
                {serviceName(p.serviceId)} · {p.city}
              </Text>
            </View>
          </Card>
        ))}
        {mine.length > 0 && (
          <>
            <Text size={16} weight="bold" color={colors.heading} style={{ marginTop: 8 }}>
              Your reviews
            </Text>
            {mine.map((r) => (
              <Card key={r.id} style={{ gap: 4 }}>
                <View style={styles.row}>
                  <Text size={14} weight="bold" color={colors.textStrong} style={{ flex: 1 }}>
                    {r.targetName}
                  </Text>
                  <StatusPill status={r.status} />
                </View>
                <Text size={12} color={colors.textMuted}>
                  {'★'.repeat(Math.round(r.overall))} {r.overall.toFixed(1)} · {formatShortDate(r.at)}
                  {r.eventDate ? ` · Event ${formatShortDate(r.eventDate)}` : ''}
                  {r.verifiedBooking ? ' · ✓ Verified' : ''}
                </Text>
                <Text size={13} color={colors.textBody}>
                  {r.text}
                </Text>
                {r.reply && (
                  <Text size={12} color={colors.textMuted}>
                    ↳ Reply: {r.reply.text}
                  </Text>
                )}
              </Card>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
});
