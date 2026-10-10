/**
 * The pieces a vendor uses to say what their business does: trade tiles,
 * main service and add-ons, business form and the trade's essentials. Used by
 * sign-up (one step each) and by Business → Your services (all together).
 */
import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceChips, KField } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { photo } from '@/constants/images';
import { SERVICE_BY_ID } from '@/data/services';
import { BUSINESS_FORMS, TRADE_BY_ID, TRADES, tradeOf, type BusinessForm, type EssentialField, type TradeId } from '@/data/trades';
import { useLayout } from '@/hooks/useLayout';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { Account } from '@/types/platform';
import { parseMoney } from '@/utils/format';

export interface VendorPersonaDraft {
  trade: TradeId;
  primaryService: string;
  services: string[];
  businessForm: BusinessForm;
  teamSize?: number;
  tradeProfile: NonNullable<Account['tradeProfile']>;
}

/** A starting draft for a trade: its core services, its usual form. */
export const draftForTrade = (trade: TradeId, keep?: Partial<VendorPersonaDraft>): VendorPersonaDraft => {
  const def = TRADE_BY_ID[trade];
  return { trade, primaryService: def.core[0], services: [...def.core], businessForm: def.defaultForm, teamSize: keep?.teamSize, tradeProfile: keep?.tradeProfile ?? {} };
};

/** A draft from an account's saved (or inferred) services. */
export const draftFromServices = (services: string[], primary: string | undefined, form: BusinessForm | undefined, account: Pick<Account, 'teamSize' | 'tradeProfile'>): VendorPersonaDraft => {
  const main = primary && SERVICE_BY_ID[primary] ? primary : (services[0] ?? 'venue');
  const trade = tradeOf(main)?.id ?? 'venue';
  return { trade, primaryService: main, services: services.length ? [...services] : [main], businessForm: form ?? TRADE_BY_ID[trade].defaultForm, teamSize: account.teamSize, tradeProfile: { ...account.tradeProfile } };
};

const name = (id: string) => SERVICE_BY_ID[id]?.name ?? id;

/** Twelve trade tiles with photos. */
export function TradeTiles({ value, onChange }: { value?: TradeId; onChange: (t: TradeId) => void }) {
  const t = useRoleTheme();
  const { medium } = useLayout();
  return (
    <View style={styles.tiles}>
      {TRADES.map((trade) => {
        const on = value === trade.id;
        return (
          <Pressable
            key={trade.id}
            onPress={() => onChange(trade.id)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={trade.label}
            style={[styles.tile, { width: medium ? '31.5%' : '48%', borderColor: on ? t.c.primary : t.c.border, backgroundColor: t.c.surface }]}>
            <Photo source={photo(trade.image)} style={styles.tileImage} contentFit="cover" />
            <View style={styles.tileText}>
              <View style={styles.row}>
                <Text size={14} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }} numberOfLines={1}>
                  {trade.label}
                </Text>
                {on && <Ionicons name="checkmark-circle" size={18} color={t.c.primary} />}
              </View>
              <Text size={12} color={t.c.muted} numberOfLines={2}>
                {trade.blurb}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Main service (single) from the trade, then add-ons from any trade, neighbours first. */
export function ServicePicker({ draft, onChange }: { draft: VendorPersonaDraft; onChange: (d: VendorPersonaDraft) => void }) {
  const t = useRoleTheme();
  const trade = TRADE_BY_ID[draft.trade];
  const addOns = draft.services.filter((s) => s !== draft.primaryService);
  const toggle = (id: string) => {
    const services = draft.services.includes(id) ? draft.services.filter((s) => s !== id) : [...draft.services, id];
    onChange({ ...draft, services: services.includes(draft.primaryService) ? services : [draft.primaryService, ...services] });
  };
  const others = TRADES.filter((x) => x.id !== draft.trade);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 6 }}>
        <Text size={14} weight="semibold" color={t.c.textStrong}>
          Your main service
        </Text>
        <ChoiceChips options={trade.services.map(name)} selected={[name(draft.primaryService)]} onToggle={(label) => {
          const id = trade.services.find((s) => name(s) === label)!;
          onChange({ ...draft, primaryService: id, services: [id, ...draft.services.filter((s) => s !== id)] });
        }} />
      </View>
      <View style={{ gap: 6 }}>
        <Text size={14} weight="semibold" color={t.c.textStrong}>
          Also offered ({addOns.length})
        </Text>
        <Text size={13} color={t.c.muted}>
          {trade.label} businesses often also offer {trade.neighbours.map((s) => name(s).toLowerCase()).join(', ')}.
        </Text>
        <ChoiceChips options={[...new Set([...trade.services, ...trade.neighbours])].filter((s) => s !== draft.primaryService).map(name)} selected={addOns.map(name)} onToggle={(label) => toggle([...trade.services, ...trade.neighbours].find((s) => name(s) === label)!)} />
      </View>
      <View style={{ gap: 10 }}>
        <Text size={14} weight="semibold" color={t.c.textStrong}>
          Services from other trades
        </Text>
        {others.map((x) => {
          const ids = x.services.filter((s) => !trade.neighbours.includes(s));
          if (!ids.length) return null;
          return (
            <View key={x.id} style={{ gap: 6 }}>
              <Text size={13} color={t.c.muted}>
                {x.label}
              </Text>
              <ChoiceChips options={ids.map(name)} selected={ids.filter((s) => draft.services.includes(s)).map(name)} onToggle={(label) => toggle(ids.find((s) => name(s) === label)!)} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** How the business is set up, and team size for anything but "just me". */
export function FormPicker({ draft, onChange }: { draft: VendorPersonaDraft; onChange: (d: VendorPersonaDraft) => void }) {
  const t = useRoleTheme();
  return (
    <View style={{ gap: 10 }}>
      {BUSINESS_FORMS.map((f) => {
        const on = draft.businessForm === f.id;
        return (
          <Pressable key={f.id} onPress={() => onChange({ ...draft, businessForm: f.id })} accessibilityRole="radio" accessibilityState={{ selected: on }} style={[styles.option, { borderColor: on ? t.c.primary : t.c.border, backgroundColor: t.c.surface }]}>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? t.c.primary : t.c.subtle} />
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={t.c.textStrong}>
                {f.label}
              </Text>
              <Text size={13} color={t.c.muted}>
                {f.blurb}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {draft.businessForm !== 'solo' && (
        <KField label="People on your team" value={draft.teamSize ? String(draft.teamSize) : ''} onChangeText={(v) => onChange({ ...draft, teamSize: Number(v.replace(/\D/g, '')) || undefined })} keyboardType="number-pad" placeholder="e.g. 8" />
      )}
    </View>
  );
}

/** The trade's two or three essentials. */
export function EssentialsForm({ draft, onChange }: { draft: VendorPersonaDraft; onChange: (d: VendorPersonaDraft) => void }) {
  return <EssentialFields fields={TRADE_BY_ID[draft.trade].essentials} profile={draft.tradeProfile} onChange={(tradeProfile) => onChange({ ...draft, tradeProfile })} />;
}

type Profile = NonNullable<Account['tradeProfile']>;

/** A short form for trade essentials or a craft profile. Empty answers are dropped. */
export function EssentialFields({ fields, profile, onChange }: { fields: EssentialField[]; profile: Profile; onChange: (p: Profile) => void }) {
  const t = useRoleTheme();
  const put = (key: string, v: string | number | boolean | string[] | undefined) => {
    const next = { ...profile };
    if (v === undefined || v === '') delete next[key];
    else next[key] = v;
    onChange(next);
  };
  const value = (f: EssentialField) => profile[f.key];
  return (
    <View style={{ gap: 14 }}>
      {fields.map((f) => {
        switch (f.kind) {
          case 'toggle':
            return (
              <View key={f.key} style={styles.row}>
                <Text size={15} color={t.c.textStrong} style={{ flex: 1 }}>
                  {f.label}
                </Text>
                <Toggle value={!!value(f)} onValueChange={(v) => put(f.key, v)} accessibilityLabel={f.label} />
              </View>
            );
          case 'choice': {
            const current = value(f);
            const selected = Array.isArray(current) ? current : current ? [String(current)] : [];
            return (
              <View key={f.key} style={{ gap: 6 }}>
                <Text size={13} weight="medium" color={t.c.text}>
                  {f.label}
                </Text>
                <ChoiceChips options={f.options} selected={selected} onToggle={(o) => put(f.key, f.multi ? (selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o]) : o)} />
              </View>
            );
          }
          case 'money':
            return <KField key={f.key} label={f.label} prefix="NPR" value={value(f) ? String(value(f)) : ''} keyboardType="number-pad" onChangeText={(v) => put(f.key, v.trim() ? parseMoney(v) || undefined : undefined)} />;
          case 'number':
            return <KField key={f.key} label={f.suffix ? `${f.label} (${f.suffix})` : f.label} value={value(f) ? String(value(f)) : ''} keyboardType="number-pad" onChangeText={(v) => put(f.key, Number(v.replace(/\D/g, '')) || undefined)} />;
          default:
            return <KField key={f.key} label={f.label} value={value(f) ? String(value(f)) : ''} placeholder={f.placeholder} onChangeText={(v) => put(f.key, v)} />;
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tile: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  tileImage: { width: '100%', height: 84 },
  tileText: { padding: 10, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 10, padding: 14 },
});
