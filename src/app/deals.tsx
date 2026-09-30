import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton } from '@/components/kit';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { colors } from '@/constants/theme';
import { findProvider } from '@/data/providers';
import { serviceName } from '@/data/services';
import { useStartChat } from '@/hooks/useChat';
import { useDb } from '@/store/useDb';
import type { Deal } from '@/types/platform';
import { daysUntil, formatMoney } from '@/utils/format';
import { shareMessage } from '@/utils/links';

const KIND_LABEL: Record<Deal['kind'], string> = {
  seasonal: 'Seasonal',
  last_minute: 'Last-minute',
  early_booking: 'Early booking',
  bundle: 'Bundles',
  referral: 'Referral',
  promo_code: 'Promo codes',
};

const offer = (d: Deal) => (d.discountPct ? `${d.discountPct}% off` : d.discountAmount ? `${formatMoney(d.discountAmount)} off` : 'Free extra');

/** Deals & offers: seasonal, last-minute (Mangsir/Poush), bundles, promo and referral codes. */
export default function DealsScreen() {
  const deals = useDb((s) => s.deals);
  const redeem = useDb((s) => s.redeemDeal);
  const startChat = useStartChat();
  const [kind, setKind] = useState<Deal['kind'] | null>(null);
  const live = deals.filter((d) => d.active && (!d.endsAt || daysUntil(d.endsAt) >= 0));
  const shown = live.filter((d) => !kind || d.kind === kind).sort((a, b) => Number(b.featured) - Number(a.featured) || (a.endsAt ?? '9').localeCompare(b.endsAt ?? '9'));
  const kinds = [...new Set(live.map((d) => d.kind))];

  const use = async (d: Deal) => {
    redeem(d.id);
    if (d.code) {
      await Clipboard.setStringAsync(d.code);
      toast(`Code ${d.code} copied. Use it at checkout or send it to your coordinator.`, 'pricetag');
      return;
    }
    const p = d.providerId ? findProvider(d.providerId) : undefined;
    if (p) startChat({ id: p.id, name: p.name, image: p.image });
    else router.push('/plan');
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Deals & offers" subtitle={`${live.length} live offers`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <ChoiceChips options={kinds.map((k) => KIND_LABEL[k])} selected={kind ? [KIND_LABEL[kind]] : []} onToggle={(l) => { const k = kinds.find((x) => KIND_LABEL[x] === l)!; setKind(kind === k ? null : k); }} />
        {shown.length === 0 && <EmptyBlock icon="pricetags-outline" title="No offers right now" message="Check back around Mangsir and Falgun — the busiest wedding months bring the best early-booking deals." />}
        {shown.map((d) => {
          const days = d.endsAt ? daysUntil(d.endsAt) : null;
          return d.featured ? (
            <View key={d.id} style={styles.hero}>
              <Text serif size={26} weight="bold" color={colors.primary} lineHeight={34}>
                {offer(d)}
              </Text>
              <Text size={17} weight="semibold" color={colors.heading}>
                {d.title}
              </Text>
              <Text size={14} color={colors.textBody}>
                {d.description}
              </Text>
              <Text size={12} color={colors.textMuted}>
                {d.providerName ?? 'Vivah'}{d.serviceId ? ` · ${serviceName(d.serviceId)}` : ''}{days !== null ? ` · ends in ${days} day${days === 1 ? '' : 's'}` : ''} · used {d.redemptions}×
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                <KButton label={d.code ? `Copy ${d.code}` : 'Claim offer'} icon={d.code ? 'copy-outline' : 'chatbubble-outline'} size="sm" onPress={() => use(d)} />
                {d.kind === 'referral' && d.code && <KButton label="Share" icon="share-social-outline" size="sm" variant="secondary" onPress={() => shareMessage(`Planning a wedding? Use my Vivah code ${d.code} — we both get ${offer(d).toLowerCase()}`)} />}
              </View>
            </View>
          ) : (
            <Card key={d.id} style={{ gap: 8 }}>
              <View style={styles.row}>
                <Text size={14} weight="bold" color={colors.primary}>
                  {offer(d)}
                </Text>
                <Text size={12} weight="medium" color={colors.textMuted}>
                  {KIND_LABEL[d.kind]}
                </Text>
                {days !== null && days <= 7 && (
                  <View style={styles.row}>
                    <Ionicons name="time-outline" size={12} color={colors.danger} />
                    <Text size={12} weight="medium" color={colors.danger}>
                      {days}d left
                    </Text>
                  </View>
                )}
              </View>
              <Text size={16} weight="semibold" color={colors.textStrong}>
                {d.title}
              </Text>
              <Text size={13} color={colors.textMuted}>
                {d.description}
              </Text>
              <View style={styles.row}>
                <Text size={12} color={colors.textMuted} style={{ flex: 1 }}>
                  {d.providerName ?? 'Vivah'}
                  {d.serviceId ? ` · ${serviceName(d.serviceId)}` : ''}
                </Text>
                <KButton label={d.code ? 'Copy code' : 'Claim'} size="sm" variant="secondary" onPress={() => use(d)} />
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgSoft },
  hero: { borderRadius: 10, padding: 16, gap: 4, backgroundColor: colors.white, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
