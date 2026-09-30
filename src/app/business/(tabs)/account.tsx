import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, KButton, ListRow, RoleHeader, SectionTitle, StatusPill, type IconName } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { photos } from '@/constants/images';
import { serviceName } from '@/data/services';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { logout } from '@/services/auth';
import { useDb, useUnreadMessageCount } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { confirm } from '@/utils/confirm';
import { formatMoney, formatPhone } from '@/utils/format';

/** Business hub: storefront, settings and every business tool. */
export default function BusinessAccount() {
  const t = useRoleTheme();
  const account = useAccount();
  const { gigs, leads, listing, payables, reviews, staff, deals } = useVendorWorkspace(account);
  const verifications = useDb((s) => s.verifications);
  const packages = useDb((s) => s.packages);
  const portfolio = useDb((s) => s.portfolio);
  const unread = useUnreadMessageCount(account);
  const [acceptingLeads, setAcceptingLeads] = useState(true);
  const [instantQuote, setInstantQuote] = useState(false);
  const vc = verifications.find((v) => v.subjectId === account.listingId || v.subjectId === account.id);
  const cover = portfolio.filter((p) => p.providerId === account.listingId).sort((a, b) => a.order - b.order)[0];
  const ready = payables.filter((p) => p.status === 'READY');

  const tools: { icon: IconName; title: string; subtitle: string; href: Href; badge?: number }[] = [
    { icon: 'chatbubbles-outline', title: 'Messages', subtitle: 'Couples, coordinators and crew', href: '/business/inbox', badge: unread },
    { icon: 'construct-outline', title: 'Business tools', subtitle: 'Expenses, VAT, roster, pricing and 16 more', href: '/business/tools' },
    { icon: 'document-text-outline', title: 'Quotations', subtitle: 'Drafts, sent, versions and wins', href: '/business/quotes' },
    { icon: 'pricetags-outline', title: 'Packages & services', subtitle: `${packages.filter((p) => p.providerId === account.listingId).length} packages · add-ons & inclusions`, href: '/business/packages' },
    { icon: 'images-outline', title: 'Portfolio', subtitle: `${portfolio.filter((p) => p.providerId === account.listingId).length} photos & videos`, href: '/business/portfolio' },
    { icon: 'megaphone-outline', title: 'Hire freelancers', subtitle: `${gigs.filter((g) => g.status === 'open').length} open gigs · ${gigs.length} total`, href: '/business/gigs' },
    { icon: 'people-outline', title: 'Team & staff', subtitle: `${staff.length} members · roles & permissions`, href: '/business/team' },
    { icon: 'person-circle-outline', title: 'Customers', subtitle: 'History, quotes, payments & follow-ups', href: '/business/customers' },
    { icon: 'wallet-outline', title: 'Finance', subtitle: `${formatMoney(ready.reduce((s, p) => s + p.amount, 0))} ready · invoices & settlements`, href: '/business/finance', badge: ready.length },
    { icon: 'stats-chart-outline', title: 'Analytics', subtitle: 'Views, leads, conversion, response time', href: '/business/analytics' },
    { icon: 'rocket-outline', title: 'Promotions', subtitle: `${deals.filter((d) => d.active).length} live deals · featured listing`, href: '/business/promotions' },
    { icon: 'star-outline', title: 'Reviews', subtitle: `${reviews.length} reviews · reply publicly`, href: '/business/reviews' },
    { icon: 'shield-checkmark-outline', title: 'Verification', subtitle: vc ? vc.status.replace('_', ' ').toLowerCase() : 'Submit documents', href: '/business/verification' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <RoleHeader title="Business" subtitle={`${listing ? serviceName(listing.serviceId) : 'Vendor'} · ${account.city}`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {cover?.image || listing ? (
            <Image source={cover?.uri ? { uri: cover.uri } : photos[cover?.image ?? listing!.image]} style={styles.cover} contentFit="cover" />
          ) : (
            <View style={[styles.cover, { backgroundColor: t.c.soft, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="images-outline" size={36} color={t.c.primary} />
            </View>
          )}
          <View style={{ padding: 16, gap: 8 }}>
            <View style={styles.row}>
              <Text size={19} weight="bold" color={t.c.textStrong} style={{ flex: 1 }}>
                {account.businessName}
              </Text>
              <StatusPill status={account.verified ? 'verified' : 'under_review'} />
            </View>
            {listing && (
              <Text size={13} color={t.c.muted}>
                {listing.rating.toFixed(1)}★ ({listing.reviewCount} reviews) · {leads.length} leads · from {formatMoney(listing.startingPrice)} {listing.priceUnit}
              </Text>
            )}
            <Text size={12} color={t.c.muted}>
              {account.name} · {formatPhone(account.phone)}
              {account.panVat ? ` · PAN/VAT ${account.panVat}` : ''}
            </Text>
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
                Pause when you’re fully booked for the season
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
          {tools.map((tool) => (
            <ListRow key={tool.title} icon={tool.icon} title={tool.title} subtitle={tool.subtitle} trailing={tool.badge ? <StatusPill status="pending" label={String(tool.badge)} /> : undefined} onPress={() => router.push(tool.href)} />
          ))}
          <ListRow icon="notifications-outline" title="Notifications" onPress={() => router.push('/notifications')} />
          <ListRow icon="settings-outline" title="Settings" subtitle="Notifications, language, privacy" onPress={() => router.push('/business/settings')} />
          <ListRow icon="help-buoy-outline" title="Vendor success team" subtitle="partners@vivah.com.np · 01-5970000" />
        </Card>

        <KButton label="Log out" variant="danger" icon="log-out-outline" onPress={() => confirm('Log out?', 'You can sign back in with your mobile number.', 'Log out', logout)} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { width: '100%', height: 160 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
