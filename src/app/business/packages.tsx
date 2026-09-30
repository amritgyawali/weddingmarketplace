import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField, StackHeader, StatusPill } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { Toggle } from '@/components/ui/Toggle';
import { toast } from '@/components/ui/Toast';
import { SERVICES, findService } from '@/data/services';
import { useExperience } from '@/hooks/useExperience';
import { has } from '@/services/experience';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { ProviderPackage } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatMoney, uid } from '@/utils/format';

const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

function PackageEditor({ pkg, onClose }: { pkg: ProviderPackage | null; onClose: () => void }) {
  const t = useRoleTheme();
  const exp = useExperience();
  const save = useDb((s) => s.savePackage);
  const [draft, setDraft] = useState<ProviderPackage | null>(pkg);
  const [crewText, setCrewText] = useState(pkg ? Object.entries(pkg.crew).map(([r, n]) => `${n} ${r}`).join('\n') : '');
  const [addOns, setAddOns] = useState(pkg ? pkg.addOns.map((a) => `${a.title} = ${a.price}`).join('\n') : '');
  if (!draft) return null;
  const patch = (p: Partial<ProviderPackage>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const def = findService(draft.serviceId);
  // Only the services this business offers (plus the package's own, if it was removed since).
  const offered = SERVICES.filter((s) => exp.services.includes(s.id) || s.id === draft.serviceId);
  const choices = offered.length ? offered : SERVICES;
  const delivers = has(exp, 'media.deliverables') || has(exp, 'stationery.proofs');
  const crewed = exp.form === 'venue' || exp.form === 'studio';

  return (
    <Sheet visible onClose={onClose} title={pkg?.title ? 'Edit package' : 'New package'}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
        <KField label="Title" value={draft.title} onChangeText={(title) => patch({ title })} placeholder="e.g. Wedding Photography Premium" />
        {choices.length > 1 && <ChoiceChips options={choices.map((s) => s.name)} selected={[def?.name ?? '']} onToggle={(name) => patch({ serviceId: choices.find((s) => s.name === name)!.id, unit: choices.find((s) => s.name === name)!.unit })} />}
        <View style={styles.row}>
          <View style={{ flex: 1.3 }}>
            <KField label="Price" value={String(draft.price || '')} onChangeText={(v) => patch({ price: Number(v.replace(/\D/g, '')) || 0 })} keyboardType="number-pad" prefix="NPR" />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Unit" value={draft.unit} onChangeText={(unit) => patch({ unit })} />
          </View>
        </View>
        <KField label="Description" value={draft.description} onChangeText={(description) => patch({ description })} multiline />
        <KField label="Included (one per line)" value={draft.included.join('\n')} onChangeText={(v) => patch({ included: lines(v) })} multiline />
        <KField label="Not included (one per line)" value={draft.excluded.join('\n')} onChangeText={(v) => patch({ excluded: lines(v) })} multiline />
        {crewed && <KField label={`Crew (e.g. “2 ${def?.crew[0]?.role ?? 'Staff'}”, one per line)`} value={crewText} onChangeText={setCrewText} multiline />}
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField label="Hours" value={String(draft.hours ?? '')} onChangeText={(v) => patch({ hours: Number(v) || undefined })} keyboardType="number-pad" />
          </View>
          {delivers && (
            <View style={{ flex: 1 }}>
              <KField label="Delivery (days)" value={String(draft.deliveryDays ?? '')} onChangeText={(v) => patch({ deliveryDays: Number(v) || undefined })} keyboardType="number-pad" />
            </View>
          )}
        </View>
        {delivers && <KField label="Deliverables (e.g. “300 Edited photos”)" value={draft.deliverables.map((d) => `${d.qty ?? ''} ${d.title}`.trim()).join('\n')} onChangeText={(v) => patch({ deliverables: lines(v).map((l) => { const m = l.match(/^(\d+)\s+(.*)$/); return m ? { qty: Number(m[1]), title: m[2] } : { title: l }; }) })} multiline />}
        <KField label="Add-ons / upgrades (“Drone = 15000”)" value={addOns} onChangeText={setAddOns} multiline />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <KField label="Discount %" value={String(draft.discountPct ?? '')} onChangeText={(v) => patch({ discountPct: Number(v) || undefined })} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <KField label="Limited slots" value={String(draft.limitedSlots ?? '')} onChangeText={(v) => patch({ limitedSlots: Number(v) || undefined })} keyboardType="number-pad" />
          </View>
        </View>
        <KButton
          label="Save package"
          disabled={!draft.title.trim() || !draft.price}
          onPress={() => {
            const crew = Object.fromEntries(lines(crewText).map((l) => { const m = l.match(/^(\d+)\s+(.*)$/); return m ? [m[2], Number(m[1])] : [l, 1]; }));
            const extras = lines(addOns).map((l) => { const [title, price] = l.split('='); return { title: title.trim(), price: Number((price ?? '').replace(/\D/g, '')) || 0 }; });
            save({ ...draft, crew, addOns: extras });
            toast('Package saved');
            onClose();
          }}
        />
        <Text size={11} color={t.c.muted} align="center">
          Packages show on your storefront and help coordinators match you faster.
        </Text>
      </ScrollView>
    </Sheet>
  );
}

/** Package builder: price, inclusions, crew, deliverables, add-ons, discounts. */
export default function Packages() {
  const t = useRoleTheme();
  const account = useAccount();
  const exp = useExperience();
  const all = useDb((s) => s.packages);
  const save = useDb((s) => s.savePackage);
  const remove = useDb((s) => s.removePackage);
  const [editing, setEditing] = useState<ProviderPackage | null>(null);
  const providerId = account.listingId ?? account.id;
  const mine = all.filter((p) => p.providerId === providerId);
  const blank = (): ProviderPackage => ({ id: uid('pkg'), providerId, serviceId: exp.primaryService ?? (account.categoryId === 'venues' ? 'venue' : 'photography'), title: '', price: 0, unit: findService(exp.primaryService ?? '')?.unit ?? 'per event', description: '', included: [], excluded: [], crew: {}, deliverables: [], addOns: [], active: true });

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Packages & services" subtitle={`${mine.length} packages`} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}>
        <KButton label="Create package" icon="add" onPress={() => setEditing(blank())} />
        {!mine.length && <EmptyBlock icon="pricetags-outline" title="No packages yet" message="Couples compare packages side by side — create Basic, Premium and Luxury tiers." />}
        {mine.map((p) => (
          <Card key={p.id} style={{ gap: 8, opacity: p.active ? 1 : 0.6 }}>
            <Pressable onPress={() => setEditing(p)} accessibilityRole="button" accessibilityLabel={`Edit ${p.title}`} style={{ gap: 8 }}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text size={12} weight="medium" color={t.c.muted}>
                  {findService(p.serviceId)?.name}
                </Text>
                <Text size={16} weight="bold" color={t.c.textStrong}>
                  {p.title}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text size={17} weight="bold" color={t.c.textStrong}>
                  {formatMoney(p.price)}
                </Text>
                <Text size={11} color={t.c.muted}>
                  {p.unit}
                </Text>
              </View>
            </View>
            {!!p.description && (
              <Text size={13} color={t.c.muted}>
                {p.description}
              </Text>
            )}
            <Text size={12} color={t.c.text}>
              Includes {p.included.join(', ')}
            </Text>
            {Object.keys(p.crew).length > 0 && (
              <Text size={12} color={t.c.muted}>
                Crew: {Object.entries(p.crew).map(([r, n]) => `${n} ${r}`).join(', ')}
              </Text>
            )}
            </Pressable>
            <View style={styles.rowBetween}>
              <View style={styles.row}>
                {!!p.discountPct && <StatusPill status="confirmed" label={`${p.discountPct}% off`} />}
                {!!p.limitedSlots && <StatusPill status="pending" label={`${p.limitedSlots} slots left`} />}
              </View>
              <View style={styles.row}>
                <Toggle value={p.active} onValueChange={(v) => save({ ...p, active: v })} accessibilityLabel={`${p.title} active`} />
                <KButton label="Delete" size="sm" variant="ghost" onPress={() => confirm('Delete package?', p.title, 'Delete', () => remove(p.id))} />
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
      <PackageEditor key={editing?.id ?? 'none'} pkg={editing} onClose={() => setEditing(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
});
