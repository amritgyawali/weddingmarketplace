import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { PaymentSheet } from '@/components/work/Payments';
import { useVendorWorkspace } from '@/hooks/useWorkspace';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Deal } from '@/types/platform';
import { addDays, formatMoney, formatShortDate, today, uid } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const PLACEMENTS = [
  { id: 'home', title: 'Homepage feature', price: 15_000, blurb: '“Top rated” carousel on the couple home screen for 30 days' },
  { id: 'category', title: 'Category spotlight', price: 8_000, blurb: 'Pinned first in your category for your city' },
  { id: 'boost', title: 'Search boost', price: 5_000, blurb: '+30% ranking weight in search and matching' },
  { id: 'verified', title: 'Premium Verified badge', price: 2_500, blurb: 'Gold badge, priority support, monthly insights' },
];

const KINDS: Deal['kind'][] = ['seasonal', 'last_minute', 'early_booking', 'bundle', 'promo_code'];

/** Deals, discount campaigns and paid placements. */
export default function Promotions() {
  const t = useRoleTheme();
  const account = useAccount();
  const { deals, listing } = useVendorWorkspace(account);
  const saveDeal = useDb((s) => s.saveDeal);
  const settings = useDb((s) => s.settings);
  const updateSettings = useDb((s) => s.updateSettings);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<Deal['kind']>('seasonal');
  const [pct, setPct] = useState('10');
  const [code, setCode] = useState('');
  const [buying, setBuying] = useState<(typeof PLACEMENTS)[number] | null>(null);
  const featured = settings.featuredProviderIds.includes(account.listingId ?? '');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Promotions" subtitle="Deals, discounts & featured listing" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <Card style={{ gap: 10 }}>
          <SectionTitle title="Create a deal" />
          <KField label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Mangsir early-booking 10% off" />
          <KField label="Details" value={description} onChangeText={setDescription} multiline placeholder="Who it’s for and what’s included" />
          <ChoiceChips options={KINDS.map((k) => k.replace('_', ' '))} selected={[kind.replace('_', ' ')]} onToggle={(v) => setKind(v.replace(' ', '_') as Deal['kind'])} />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <KField label="Discount %" value={pct} onChangeText={(v) => setPct(v.replace(/\D/g, ''))} keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <KField label="Promo code (optional)" value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" />
            </View>
          </View>
          <KButton
            label="Publish deal"
            disabled={!title.trim() || !Number(pct)}
            onPress={() => {
              saveDeal({ id: uid('deal'), providerId: account.listingId, providerName: account.businessName, serviceId: listing?.serviceId, title: title.trim(), description: description.trim(), kind, discountPct: Number(pct), code: code.trim() || undefined, endsAt: addDays(today(), 30), featured: false, active: true, redemptions: 0 });
              setTitle('');
              setDescription('');
              setCode('');
              toast('Deal live on your storefront', 'pricetag');
            }}
          />
        </Card>
        <View>
          <SectionTitle title={`Your deals (${deals.length})`} />
          {deals.map((d) => (
            <Card key={d.id} style={[styles.row, { marginBottom: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text size={14} weight="bold" color={t.c.textStrong}>
                  {d.title}
                </Text>
                <Text size={12} color={t.c.muted}>
                  {d.discountPct ? `${d.discountPct}% off` : d.discountAmount ? `${formatMoney(d.discountAmount)} off` : ''} · {d.redemptions} redeemed {d.endsAt ? `· ends ${formatShortDate(d.endsAt)}` : ''}
                </Text>
              </View>
              <Toggle value={d.active} onValueChange={(v) => saveDeal({ ...d, active: v })} accessibilityLabel={`Toggle ${d.title}`} />
            </Card>
          ))}
        </View>
        <View>
          <SectionTitle title="Paid placements" />
          {PLACEMENTS.map((p) => (
            <Card key={p.id} style={{ gap: 6, marginBottom: 8 }}>
              <View style={styles.rowBetween}>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  {p.title}
                </Text>
                {p.id === 'home' && featured ? <StatusPill status="confirmed" label="Active" /> : <Text size={14} weight="bold" color={t.c.primary}>{formatMoney(p.price)}</Text>}
              </View>
              <Text size={12} color={t.c.muted}>
                {p.blurb}
              </Text>
              {!(p.id === 'home' && featured) && <KButton label="Buy" size="sm" variant="secondary" onPress={() => setBuying(p)} />}
            </Card>
          ))}
        </View>
      </ScrollView>
      <PaymentSheet
        visible={!!buying}
        title={buying?.title ?? ''}
        amount={buying?.price ?? 0}
        onClose={() => setBuying(null)}
        onPay={() => {
          if (buying?.id === 'home' && account.listingId) updateSettings({ featuredProviderIds: [...settings.featuredProviderIds, account.listingId] });
          useDb.setState((s) => ({ revenue: [{ id: uid('rev'), kind: buying?.id === 'verified' ? 'SUBSCRIPTION' : 'FEATURED', amount: buying?.price ?? 0, providerId: account.listingId, note: buying?.title, at: new Date().toISOString() }, ...s.revenue] }));
          toast(`${buying?.title} activated`, 'rocket');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
