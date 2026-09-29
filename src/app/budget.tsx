import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Card, ChoiceChips, EmptyBlock, KButton, KField, ProgressBar, SectionTitle } from '@/components/kit';
import { ToolScreen, toolStyles } from '@/components/planner/ToolScreen';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { serviceName } from '@/data/services';
import { exportCsv } from '@/services/exporters';
import { allocateBudget, savingTips } from '@/services/planner';
import { paymentSummary } from '@/services/pricing';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { BudgetLine, Project } from '@/types/platform';
import { confirm } from '@/utils/confirm';
import { formatMoney, formatMoneyCompact, parseMoney } from '@/utils/format';

const money = (v: string) => {
  const n = parseMoney(v);
  return Number.isFinite(n) ? n : 0;
};

/** Costs couples usually pay outside the platform. */
const OWN_CATEGORIES = ['Wedding attire', 'Jewellery', 'Puja samagri', 'Gifts & dakshina', 'Invitation cards', 'Travel & stay', 'Honeymoon', 'Other'];

interface Row {
  key: string;
  label: string;
  sub: string;
  planned: number;
  committed: number;
  paid: number;
  line?: BudgetLine;
  booked: boolean;
}

function Budget({ project, readOnly }: { project: Project; readOnly: boolean }) {
  const t = useRoleTheme();
  const lines = useDb((s) => s.budget);
  const addLine = useDb((s) => s.addBudgetLine);
  const updateLine = useDb((s) => s.updateBudgetLine);
  const removeLine = useDb((s) => s.removeBudgetLine);
  const patchProject = useDb((s) => s.patchProject);
  const [editing, setEditing] = useState<Partial<BudgetLine> | null>(null);
  const [totalOpen, setTotalOpen] = useState(false);
  const [totalText, setTotalText] = useState(String(project.budget ?? ''));

  const mine = lines.filter((l) => l.projectId === project.id);
  const services = [...new Set(project.requirements.filter((r) => r.status !== 'CANCELLED').map((r) => r.serviceId))];
  const active = project.events.filter((e) => e.status !== 'cancelled').length || 1;
  const allocation = project.budget ? allocateBudget(project.budget * 0.9, services, project.guests, active) : {};
  const bookings = project.bookings.filter((b) => b.status !== 'CANCELLED');
  const pay = paymentSummary(project);
  const bookedTotal = bookings.reduce((s, b) => s + b.agreedPrice, 0);

  const serviceRows: Row[] = services.map((id) => {
    const booked = bookings.filter((b) => b.serviceId === id);
    const committed = booked.reduce((s, b) => s + b.agreedPrice, 0);
    const req = project.requirements.find((r) => r.serviceId === id);
    return {
      key: id,
      label: serviceName(id),
      sub: booked.length ? `Booked · ${booked.map((b) => b.providerName).join(', ')}` : req?.status === 'QUOTED' ? 'Quote received' : 'Not booked yet',
      planned: allocation[id] ?? req?.budgetMax ?? 0,
      committed,
      // Platform payments are pooled across bookings — share them pro-rata.
      paid: bookedTotal ? Math.round((pay.paid * committed) / bookedTotal) : 0,
      booked: booked.length > 0,
    };
  });
  const ownRows: Row[] = mine.map((l) => ({ key: l.id, label: l.label, sub: l.notes ?? (l.serviceId || 'Own purchase'), planned: l.estimated, committed: l.actual ?? 0, paid: l.paid, line: l, booked: !!l.actual }));
  const rows = [...serviceRows, ...ownRows];
  const planned = rows.reduce((s, r) => s + r.planned, 0);
  const committed = rows.reduce((s, r) => s + r.committed, 0);
  const paid = rows.reduce((s, r) => s + r.paid, 0);
  const total = project.budget ?? planned;
  const forecast = rows.reduce((s, r) => s + Math.max(r.committed, r.planned), 0);
  const over = forecast - total;
  const tips = savingTips(project);

  const saveLine = () => {
    if (!editing?.label?.trim()) return toast('Give this expense a name', 'alert-circle');
    const data = { projectId: project.id, serviceId: editing.serviceId ?? '', label: editing.label.trim(), estimated: editing.estimated ?? 0, actual: editing.actual, paid: editing.paid ?? 0, due: editing.due, notes: editing.notes };
    if (editing.id) updateLine(editing.id, data);
    else addLine(data);
    setEditing(null);
    toast('Budget updated', 'wallet');
  };

  return (
    <>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
        <Card style={{ gap: 12 }}>
          <View style={toolStyles.between}>
            <View>
              <Text size={12} weight="bold" color={t.c.muted} tracking={0.6}>
                TOTAL BUDGET
              </Text>
              <Text size={28} weight="bold" color={t.c.textStrong}>
                {formatMoney(total)}
              </Text>
            </View>
            {!readOnly && <KButton label="Edit" size="sm" variant="ghost" icon="create-outline" onPress={() => setTotalOpen(true)} />}
          </View>
          <View style={styles.stack}>
            <View style={{ flex: Math.max(0.001, paid), backgroundColor: t.c.success }} />
            <View style={{ flex: Math.max(0.001, committed - paid), backgroundColor: t.c.primary }} />
            <View style={{ flex: Math.max(0.001, total - committed), backgroundColor: t.c.surfaceAlt }} />
          </View>
          <View style={toolStyles.stats}>
            {[
              { label: 'Paid', value: paid, color: t.c.success },
              { label: 'Booked', value: committed, color: t.c.primary },
              { label: 'Left to book', value: Math.max(0, total - committed), color: t.c.muted },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1 }}>
                <View style={toolStyles.row}>
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text size={12} color={t.c.muted}>
                    {s.label}
                  </Text>
                </View>
                <Text size={15} weight="bold" color={t.c.textStrong}>
                  {formatMoneyCompact(s.value)}
                </Text>
              </View>
            ))}
          </View>
          <Text size={12} color={over > 0 ? t.c.danger : t.c.success}>
            {over > 0 ? `Forecast ${formatMoneyCompact(forecast)} — ${formatMoneyCompact(over)} over budget.` : `Forecast ${formatMoneyCompact(forecast)} — ${formatMoneyCompact(-over)} headroom.`}
            {pay.outstanding > 0 ? ` ${formatMoneyCompact(pay.outstanding)} still due to Vivah.` : ''}
          </Text>
        </Card>

        <SectionTitle title="Through Vivah" />
        {serviceRows.length === 0 ? (
          <EmptyBlock icon="construct-outline" title="No services requested yet" />
        ) : (
          serviceRows.map((r) => <BudgetRow key={r.key} row={r} />)
        )}

        <SectionTitle title="Your own purchases" action={readOnly ? undefined : 'Add'} onAction={() => setEditing({ label: '', estimated: 0, paid: 0 })} />
        {ownRows.length === 0 ? (
          <Text size={13} color={t.c.muted}>
            Track attire, jewellery, puja samagri, gifts and anything you buy yourself so the whole wedding lives in one budget.
          </Text>
        ) : (
          ownRows.map((r) => <BudgetRow key={r.key} row={r} onPress={readOnly ? undefined : () => setEditing(r.line!)} />)
        )}

        {tips.length > 0 && (
          <Card style={{ gap: 8 }}>
            <View style={toolStyles.row}>
              <Ionicons name="bulb-outline" size={18} color={t.c.primary} />
              <Text size={15} weight="bold" color={t.c.textStrong}>
                Ways to save
              </Text>
            </View>
            {tips.map((tip) => (
              <Text key={tip} size={13} color={t.c.text} lineHeight={19}>
                • {tip}
              </Text>
            ))}
          </Card>
        )}

        <KButton
          label="Export budget (CSV)"
          icon="download-outline"
          variant="secondary"
          onPress={() => exportCsv(rows.map((r) => ({ item: r.label, status: r.sub, planned_npr: r.planned, booked_npr: r.committed, paid_npr: r.paid, balance_npr: r.committed - r.paid })), `${project.code}-budget`)}
        />
      </ScrollView>

      <Sheet visible={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit expense' : 'Add expense'} footer={<KButton label="Save" onPress={saveLine} />}>
        {editing && (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <ChoiceChips options={OWN_CATEGORIES} selected={editing.serviceId ? [editing.serviceId] : []} onToggle={(v) => setEditing((e) => ({ ...e, serviceId: v, label: e?.label || v }))} />
            <KField label="What" value={editing.label ?? ''} onChangeText={(v) => setEditing((e) => ({ ...e, label: v }))} placeholder="e.g. Bridal lehenga from New Road" />
            <View style={toolStyles.row}>
              <View style={{ flex: 1 }}>
                <KField label="Planned" value={editing.estimated ? String(editing.estimated) : ''} onChangeText={(v) => setEditing((e) => ({ ...e, estimated: money(v) }))} keyboardType="number-pad" prefix="NPR" />
              </View>
              <View style={{ flex: 1 }}>
                <KField label="Actual" value={editing.actual ? String(editing.actual) : ''} onChangeText={(v) => setEditing((e) => ({ ...e, actual: money(v) || undefined }))} keyboardType="number-pad" prefix="NPR" />
              </View>
            </View>
            <KField label="Paid so far" value={editing.paid ? String(editing.paid) : ''} onChangeText={(v) => setEditing((e) => ({ ...e, paid: money(v) }))} keyboardType="number-pad" prefix="NPR" />
            <KField label="Notes" value={editing.notes ?? ''} onChangeText={(v) => setEditing((e) => ({ ...e, notes: v || undefined }))} />
            {editing.id && (
              <KButton
                label="Delete"
                variant="ghost"
                icon="trash-outline"
                onPress={() =>
                  confirm('Delete expense?', editing.label ?? '', 'Delete', () => {
                    removeLine(editing.id!);
                    setEditing(null);
                  })
                }
              />
            )}
          </View>
        )}
      </Sheet>
      <Sheet visible={totalOpen} onClose={() => setTotalOpen(false)} title="Overall budget">
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <KField value={totalText} onChangeText={setTotalText} prefix="NPR" placeholder="e.g. 25 lakh or 2500000" />
          <Text size={12} color={t.c.muted}>
            Your coordinator sees this when recommending providers. Suggested amounts per service update instantly.
          </Text>
          <KButton
            label="Save"
            onPress={() => {
              const v = parseMoney(totalText);
              if (!v) return toast('Enter an amount like 25 lakh or 2500000', 'alert-circle');
              patchProject(project.id, { budget: v });
              setTotalOpen(false);
            }}
          />
        </View>
      </Sheet>
    </>
  );
}

function BudgetRow({ row, onPress }: { row: Row; onPress?: () => void }) {
  const t = useRoleTheme();
  const base = Math.max(row.planned, row.committed, 1);
  const over = row.committed > row.planned && row.planned > 0;
  return (
    <Card onPress={onPress} style={{ gap: 8, padding: 14 }}>
      <View style={toolStyles.between}>
        <View style={{ flex: 1 }}>
          <Text size={15} weight="semibold" color={t.c.textStrong}>
            {row.label}
          </Text>
          <Text size={12} color={t.c.muted} numberOfLines={1}>
            {row.sub}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text size={15} weight="bold" color={over ? t.c.danger : t.c.textStrong}>
            {formatMoneyCompact(row.committed || row.planned)}
          </Text>
          <Text size={11} color={t.c.muted}>
            {row.committed ? `plan ${formatMoneyCompact(row.planned)}` : 'suggested'}
          </Text>
        </View>
      </View>
      <View style={styles.track}>
        <ProgressBar value={row.committed / base} color={over ? t.c.danger : t.c.primary} />
        <View style={[StyleSheet.absoluteFill, { width: `${Math.min(100, (row.paid / base) * 100)}%`, backgroundColor: t.c.success, borderRadius: 3, height: 6 }]} />
      </View>
      {row.paid > 0 && (
        <Text size={11} color={t.c.success}>
          {formatMoney(row.paid)} paid
        </Text>
      )}
    </Card>
  );
}

/** Wedding budget: suggested split per service, booked vs paid, own purchases, forecast and savings tips. */
export default function BudgetScreen() {
  return (
    <ToolScreen title="Budget" subtitle={(p) => `${p.title} · ${p.guests} guests`}>
      {(project, { readOnly }) => <Budget project={project} readOnly={readOnly} />}
    </ToolScreen>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 6 },
});
