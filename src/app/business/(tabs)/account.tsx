import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, KButton, KeyValue, ListRow, RoleHeader, SectionTitle, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { photos } from '@/constants/images';
import { findCategory } from '@/data/categories';
import { VENDORS } from '@/data/vendors';
import { VENUES } from '@/data/venues';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { logout } from '@/services/auth';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { formatINR } from '@/utils/format';
import { confirm } from '@/utils/confirm';

export default function BusinessAccount() {
  const t = useRoleTheme();
  const account = useAccount();
  const { gigs, leads } = useVendorWorkspace(account);
  const [acceptingLeads, setAcceptingLeads] = useState(true);
  const [instantQuote, setInstantQuote] = useState(false);

  const venue = VENUES.find((v) => v.id === account.listingId);
  const vendor = VENDORS.find((v) => v.id === account.listingId);
  const listing = venue ?? vendor;
  const category = findCategory(account.categoryId ?? '')?.title ?? 'Vendor';

  const confirmLogout = () =>
    confirm('Log out?', 'You can sign back in with your mobile number.', 'Log out', logout);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader eyebrow="STOREFRONT" title="Business" subtitle={`${category} · ${account.city}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {listing ? (
            <Image source={photos[listing.images[0]]} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: t.c.soft, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="images-outline" size={36} color={t.c.primary} />
              <Text size={13} color={t.c.primary}>
                Add cover photos to your storefront
              </Text>
            </View>
          )}
          <View style={{ padding: 16, gap: 8 }}>
            <View style={styles.row}>
              <Text size={19} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
                {account.businessName}
              </Text>
              <StatusPill status={account.verified ? 'approved' : 'pending'} label={account.verified ? 'Verified' : 'Verification pending'} />
            </View>
            {listing && (
              <View style={styles.row}>
                <Ionicons name="star" size={15} color={t.c.warning} />
                <Text size={14} weight="semibold" color={t.c.textStrong}>
                  {listing.rating.toFixed(1)}
                </Text>
                <Text size={13} color={t.c.muted}>
                  ({listing.reviewCount} reviews) · {leads.length} leads received
                </Text>
              </View>
            )}
            {venue && (
              <>
                <KeyValue label="Rental / function" value={formatINR(venue.rentalCost)} />
                <KeyValue label="Veg per plate" value={formatINR(venue.vegPerPlate)} />
                <KeyValue label="Capacity" value={`${venue.capacity.min}–${venue.capacity.max} guests`} />
              </>
            )}
            {vendor && vendor.packages.map((p) => <KeyValue key={p.name} label={`${p.name} package`} value={`${formatINR(p.price)} ${p.unit}`} />)}
          </View>
        </Card>

        <Card style={{ gap: 14 }}>
          <SectionTitle title="Lead settings" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                Accepting new enquiries
              </Text>
              <Text size={12} color={t.c.muted}>
                Pause when you are fully booked for the season
              </Text>
            </View>
            <Toggle value={acceptingLeads} onValueChange={(v) => { setAcceptingLeads(v); toast(v ? 'Your listing is live' : 'Listing paused'); }} accessibilityLabel="Accepting new enquiries" />
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                Instant quote
              </Text>
              <Text size={12} color={t.c.muted}>
                Auto-send your standard package to new leads
              </Text>
            </View>
            <Toggle value={instantQuote} onValueChange={setInstantQuote} accessibilityLabel="Instant quote" />
          </View>
        </Card>

        <Card padded={false} style={{ overflow: 'hidden' }}>
          <ListRow icon="megaphone-outline" title="Hire freelancers" subtitle={`${gigs.filter((g) => g.status === 'open').length} open gigs · ${gigs.length} total`} onPress={() => router.push('/business/gigs')} />
          <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
          <ListRow icon="call-outline" title="Contact" subtitle={`${account.name} · +91 ${account.phone}`} />
          <ListRow icon="help-buoy-outline" title="Vendor success team" subtitle="partners@vivah.app" />
        </Card>

        <KButton label="Log out" variant="danger" icon="log-out-outline" onPress={confirmLogout} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 160 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
