import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, KButton, KField, SectionTitle, StackHeader, StatusPill } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { CITIES } from '@/data/cities';
import { findProvider } from '@/data/providers';
import { SERVICES } from '@/data/services';
import { PRICING_MODELS } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Deal } from '@/types/platform';
import { formatMoney, uid } from '@/utils/format';

/** Marketplace configuration: business-model rates, cities, featured providers, deals and banners. */
export default function MarketplaceSettings() {
  const t = useRoleTheme();
  const settings = useDb((s) => s.settings);
  const update = useDb((s) => s.updateSettings);
  const deals = useDb((s) => s.deals);
  const saveDeal = useDb((s) => s.saveDeal);
  const [rates, setRates] = useState({
    commission: String(Math.round(settings.commissionRate * 100)),
    markup: String(Math.round(settings.markupRate * 100)),
    lead: String(settings.leadFee),
    margin: String(Math.round(settings.freelancerMargin * 100)),
    service: String(Math.round(settings.serviceFeeRate * 1000) / 10),
    emergency: String(settings.emergencyFee),
  });
  const [code, setCode] = useState('');
  const [pct, setPct] = useState('');
  const [title, setTitle] = useState('');

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Marketplace settings" subtitle="Business models, catalogue & promotions" />
      <ScrollView contentContainerStyle={{ padding: 14, gap: 16, paddingBottom: 40 }}>
        <Card style={{ gap: 12 }}>
          <SectionTitle title="Business models" />
          {PRICING_MODELS.map((m) => (
            <Text key={m.id} size={12} color={t.c.muted}>
              {m.label}: {m.blurb}
            </Text>
          ))}
          <View style={styles.grid}>
            <KField label="Commission %" value={rates.commission} onChangeText={(v) => setRates((r) => ({ ...r, commission: v }))} keyboardType="number-pad" />
            <KField label="Markup %" value={rates.markup} onChangeText={(v) => setRates((r) => ({ ...r, markup: v }))} keyboardType="number-pad" />
            <KField label="Lead fee (NPR)" value={rates.lead} onChangeText={(v) => setRates((r) => ({ ...r, lead: v }))} keyboardType="number-pad" />
            <KField label="Freelancer margin %" value={rates.margin} onChangeText={(v) => setRates((r) => ({ ...r, margin: v }))} keyboardType="number-pad" />
            <KField label="Service fee % of package" value={rates.service} onChangeText={(v) => setRates((r) => ({ ...r, service: v }))} keyboardType="decimal-pad" />
            <KField label="Emergency fee (NPR)" value={rates.emergency} onChangeText={(v) => setRates((r) => ({ ...r, emergency: v }))} keyboardType="number-pad" />
          </View>
          <KButton
            label="Save rates"
            onPress={() => {
              update({
                commissionRate: (Number(rates.commission) || 0) / 100,
                markupRate: (Number(rates.markup) || 0) / 100,
                leadFee: Number(rates.lead) || 0,
                freelancerMargin: (Number(rates.margin) || 0) / 100,
                serviceFeeRate: (Number(rates.service) || 0) / 100,
                emergencyFee: Number(rates.emergency) || 0,
              });
              toast('Rates updated — new bookings use them');
            }}
          />
          <Text size={12} color={t.c.muted}>
            Example: customer pays {formatMoney(100_000)} → provider {formatMoney(100_000 * (1 - (Number(rates.commission) || 0) / 100))}, platform {formatMoney(100_000 * ((Number(rates.commission) || 0) / 100))}.
          </Text>
        </Card>

        <Card style={{ gap: 12 }}>
          <SectionTitle title="Coordination" />
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text size={14} weight="semibold" color={t.c.textStrong}>
                Auto-assign coordinator
              </Text>
              <Text size={12} color={t.c.muted}>
                New requirements go straight to an available coordinator
              </Text>
            </View>
            <Toggle value={settings.autoAssignCoordinator} onValueChange={(v) => update({ autoAssignCoordinator: v })} accessibilityLabel="Auto-assign coordinator" />
          </View>
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Launch cities" />
          <ChoiceChips options={CITIES.filter((c) => c.group === 'metro' || c.group === 'popular').map((c) => c.name)} selected={settings.cities} onToggle={(c) => update({ cities: settings.cities.includes(c) ? settings.cities.filter((x) => x !== c) : [...settings.cities, c] })} />
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Service categories" />
          <Text size={12} color={t.c.muted}>
            {SERVICES.length} services across the catalogue, each with its own requirement fields, crew roles, review criteria and deliverables.
          </Text>
          <View style={styles.chips}>
            {SERVICES.map((s) => (
              <StatusPill key={s.id} status={s.core ? 'confirmed' : 'draft'} label={s.name} />
            ))}
          </View>
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Featured providers" />
          {settings.featuredProviderIds.map((id) => (
            <View key={id} style={styles.rowBetween}>
              <Text size={13} color={t.c.text}>
                ⭐ {findProvider(id)?.name ?? id}
              </Text>
              <KButton label="Remove" size="sm" variant="ghost" onPress={() => update({ featuredProviderIds: settings.featuredProviderIds.filter((x) => x !== id) })} />
            </View>
          ))}
          <Text size={12} color={t.c.muted}>
            Feature more from Providers → provider detail.
          </Text>
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Deals & promo codes" />
          {deals.map((d) => (
            <View key={d.id} style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text size={13} weight="semibold" color={t.c.textStrong}>
                  {d.title}
                </Text>
                <Text size={11} color={t.c.muted}>
                  {d.providerName ?? 'Platform'} · {d.kind.replace('_', ' ')} {d.code ? `· ${d.code}` : ''} · {d.redemptions} used
                </Text>
              </View>
              <Toggle value={d.active} onValueChange={(v) => saveDeal({ ...d, active: v })} accessibilityLabel={`Toggle ${d.title}`} />
            </View>
          ))}
          <View style={styles.grid}>
            <KField label="Campaign title" value={title} onChangeText={setTitle} placeholder="Dashain special" />
            <KField label="Promo code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} placeholder="DASHAIN15" autoCapitalize="characters" />
            <KField label="Discount %" value={pct} onChangeText={setPct} keyboardType="number-pad" />
          </View>
          <KButton
            label="Create promo code"
            size="sm"
            disabled={!code.trim() || !title.trim() || !Number(pct)}
            onPress={() => {
              const deal: Deal = { id: uid('deal'), title: title.trim(), description: `${pct}% off the coordination fee with code ${code}`, kind: 'promo_code', code: code.trim(), discountPct: Number(pct), featured: true, active: true, redemptions: 0 };
              saveDeal(deal);
              setCode('');
              setPct('');
              setTitle('');
              toast('Promo code live');
            }}
          />
        </Card>

        <Card style={{ gap: 10 }}>
          <SectionTitle title="Home banners" />
          {settings.banners.map((b) => (
            <View key={b.id} style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text size={13} weight="semibold" color={t.c.textStrong}>
                  {b.title}
                </Text>
                <Text size={11} color={t.c.muted}>
                  {b.subtitle}
                </Text>
              </View>
              <Toggle value={b.active} onValueChange={(v) => update({ banners: settings.banners.map((x) => (x.id === b.id ? { ...x, active: v } : x)) })} accessibilityLabel={`Toggle banner ${b.title}`} />
            </View>
          ))}
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: 10 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
