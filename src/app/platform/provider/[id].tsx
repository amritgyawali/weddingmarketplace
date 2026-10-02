import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, KButton, KeyValue, ProgressBar, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { AvailabilityCalendar } from '@/components/work/AvailabilityCalendar';
import { photos } from '@/constants/images';
import { findProvider } from '@/data/providers';
import { serviceName } from '@/data/services';
import { useDb } from '@/store/useDb';
import { useSession } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatMoney, formatShortDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

/** Coordinator view of a provider: public profile + internal reliability signals. */
export default function PlatformProvider() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const provider = findProvider(id);
  const projects = useDb((s) => s.projects);
  const reviews = useDb((s) => s.reviews);
  const settings = useDb((s) => s.settings);
  const updateSettings = useDb((s) => s.updateSettings);
  const owner = useSession((s) => s.accounts.find((a) => a.role === 'vendor' && a.listingId === id));

  if (!provider) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Provider" />
        <EmptyBlock title="Provider not found" />
      </View>
    );
  }

  const bookings = projects.flatMap((p) => p.bookings.filter((b) => b.providerId === id).map((b) => ({ p, b })));
  const myReviews = reviews.filter((r) => r.targetId === id);
  const featured = settings.featuredProviderIds.includes(id);
  const i = provider.internal;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title={provider.name} subtitle={`${serviceName(provider.serviceId)} · ${provider.city}`} right={<StatusPill status={provider.verification} />} />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 14, paddingBottom: 40 }}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          <Image source={photos[provider.image]} style={{ width: '100%', height: 150 }} contentFit="cover" />
          <View style={{ padding: 14, gap: 4 }}>
            <KeyValue label="Rating" value={`${provider.rating}★ (${provider.reviewCount})`} />
            <KeyValue label="Starting price" value={`${formatMoney(provider.startingPrice)} ${provider.priceUnit}`} />
            <KeyValue label="Experience" value={`${provider.experienceYears} yrs · ${provider.completedProjects} events`} />
            <KeyValue label="Service areas" value={provider.serviceAreas.join(', ')} />
            <KeyValue label="Languages" value={provider.languages.join(', ')} />
            <KeyValue label="Claimed by" value={owner ? `${owner.name} (${owner.phone})` : 'Unclaimed listing'} />
          </View>
        </Card>
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Internal reliability (not public)" />
          <View style={styles.score}>
            <Text size={34} weight="bold" color={i.reliability >= 80 ? t.c.success : i.reliability >= 60 ? t.c.warning : t.c.danger}>
              {i.reliability}
            </Text>
            <Text size={12} color={t.c.muted} style={{ flex: 1 }}>
              Completion, cancellations, response time, late arrivals, disputes, ratings and repeat bookings combined.
            </Text>
          </View>
          {[
            { label: 'Completion rate', v: i.completionRate },
            { label: 'Response rate', v: i.responseRate },
            { label: 'Cancellation rate', v: i.cancellationRate, bad: true },
            { label: 'Platform priority', v: i.platformPriority },
          ].map((x) => (
            <View key={x.label} style={{ gap: 4 }}>
              <View style={styles.rowBetween}>
                <Text size={13} color={t.c.text}>
                  {x.label}
                </Text>
                <Text size={13} weight="bold" color={x.bad && x.v >= 0.15 ? t.c.danger : t.c.textStrong}>
                  {Math.round(x.v * 100)}%
                </Text>
              </View>
              <ProgressBar value={x.v} color={x.bad ? t.c.danger : undefined} />
            </View>
          ))}
          <KeyValue label="Avg response time" value={`${i.responseMinutes} min`} />
          <KeyValue label="Late arrivals / disputes" value={`${i.lateArrivals} / ${i.disputes}`} />
        </Card>
        <KButton
          label={featured ? 'Remove from featured' : 'Feature on home & search'}
          icon="star-outline"
          variant={featured ? 'ghost' : 'secondary'}
          onPress={() => {
            updateSettings({ featuredProviderIds: featured ? settings.featuredProviderIds.filter((x) => x !== id) : [...settings.featuredProviderIds, id] });
            toast(featured ? 'Removed from featured' : 'Now featured');
          }}
        />
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Availability" />
          <AvailabilityCalendar ownerKind="provider" ownerId={id} />
        </Card>
        <View>
          <SectionTitle title={`Bookings (${bookings.length})`} />
          {bookings.map(({ p, b }) => (
            <Card key={b.id} onPress={() => router.push({ pathname: '/platform/project/[id]', params: { id: p.id } })} style={[styles.rowBetween, { marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  {p.code} · {p.title}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {formatShortDate(p.weddingDate)} · {formatMoney(b.agreedPrice)} · fee {formatMoney(b.platformFee)}
                </Text>
              </View>
              <StatusPill status={b.status} />
            </Card>
          ))}
        </View>
        <View>
          <SectionTitle title={`Reviews (${myReviews.length})`} />
          {myReviews.map((r) => (
            <Card key={r.id} style={{ gap: 4, marginBottom: 8 }}>
              <Text size={13} weight="bold" color={t.c.textStrong}>
                {r.overall}★ · {r.authorName}
              </Text>
              <Text size={13} color={t.c.text}>
                {r.text}
              </Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  score: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
