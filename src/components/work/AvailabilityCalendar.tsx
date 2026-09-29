import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceChips, KButton, KField } from '@/components/kit';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { BS_MONTHS, bsMonthLabel } from '@/data/events';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { AvailabilityEntry, AvailabilityStatus, DayPart } from '@/types/platform';
import { toISODate } from '@/utils/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RANK: Record<AvailabilityStatus, number> = { AVAILABLE: 0, TENTATIVE: 1, HELD: 2, BOOKED: 3, UNAVAILABLE: 4 };

export function statusColor(s: AvailabilityStatus, t: ReturnType<typeof useRoleTheme>) {
  return s === 'BOOKED' ? t.c.danger : s === 'UNAVAILABLE' ? t.c.muted : s === 'HELD' ? t.c.warning : s === 'TENTATIVE' ? t.c.info : t.c.success;
}

/**
 * Month calendar of AVAILABLE / TENTATIVE / HELD / BOOKED / UNAVAILABLE days.
 * Booking-driven entries are read-only; owners edit manual days and weekly rules.
 */
export function AvailabilityCalendar({ ownerKind, ownerId, onSelectDay }: { ownerKind: AvailabilityEntry['ownerKind']; ownerId: string; onSelectDay?: (date: string) => void }) {
  const t = useRoleTheme();
  const entries = useDb((s) => s.availability);
  const rules = useDb((s) => s.availabilityRules);
  const setAvailability = useDb((s) => s.setAvailability);
  const addRule = useDb((s) => s.addAvailabilityRule);
  const removeRule = useDb((s) => s.removeAvailabilityRule);
  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [selected, setSelected] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<AvailabilityStatus>('UNAVAILABLE');
  const [part, setPart] = useState<DayPart>('full');
  const [note, setNote] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);

  const mine = entries.filter((e) => e.ownerId === ownerId);
  const myRules = rules.filter((r) => r.ownerId === ownerId);
  const dayStatus = (iso: string): { status: AvailabilityStatus; entries: AvailabilityEntry[]; rule: boolean } => {
    const list = mine.filter((e) => e.date === iso);
    const weekday = new Date(`${iso}T00:00:00`).getDay();
    const rule = myRules.find((r) => r.weekday === weekday);
    const worst = list.reduce<AvailabilityStatus>((w, e) => (RANK[e.status] > RANK[w] ? e.status : w), rule ? rule.status : 'AVAILABLE');
    return { status: worst, entries: list, rule: !!rule && !list.length };
  };

  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const iso = (d: number) => toISODate(new Date(cursor.y, cursor.m, d));
  const move = (delta: number) => setCursor(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));
  const counts = Array.from({ length: daysInMonth }, (_, i) => dayStatus(iso(i + 1)).status).reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {});
  const detail = selected.length === 1 ? dayStatus(selected[0]) : null;

  return (
    <View style={{ gap: 12 }}>
      <View style={styles.header}>
        <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={22} color={t.c.textStrong} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text size={16} weight="bold" color={t.c.textStrong}>
            {MONTHS[cursor.m]} {cursor.y}
          </Text>
          <Text size={11} color={t.c.muted}>
            {bsMonthLabel(iso(1))} – {BS_MONTHS[(BS_MONTHS.indexOf(bsMonthLabel(iso(daysInMonth)).split(' ')[0]) + 12) % 12]}
          </Text>
        </View>
        <Pressable onPress={() => move(1)} hitSlop={10} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={22} color={t.c.textStrong} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w) => (
          <Text key={w} size={11} weight="semibold" color={t.c.muted} align="center" style={{ flex: 1 }}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const date = iso(d);
          const s = dayStatus(date);
          const color = statusColor(s.status, t);
          const on = selected.includes(date);
          const isToday = date === toISODate(now);
          return (
            <Pressable
              key={i}
              onPress={() => {
                onSelectDay?.(date);
                setSelected((cur) => (cur.includes(date) ? cur.filter((x) => x !== date) : [...cur, date]));
              }}
              style={styles.cell}
              accessibilityLabel={`${date} ${s.status}`}>
              <View style={[styles.day, { backgroundColor: s.status === 'AVAILABLE' ? 'transparent' : `${color}26`, borderColor: on ? t.c.primary : isToday ? t.c.textStrong : 'transparent' }]}>
                <Text size={14} weight={on || isToday ? 'bold' : 'medium'} color={s.status === 'AVAILABLE' ? t.c.textStrong : color}>
                  {d}
                </Text>
                {s.status !== 'AVAILABLE' && <View style={[styles.dot, { backgroundColor: color, opacity: s.rule ? 0.5 : 1 }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        {(['AVAILABLE', 'TENTATIVE', 'HELD', 'BOOKED', 'UNAVAILABLE'] as AvailabilityStatus[]).map((s) => (
          <View key={s} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: statusColor(s, t) }]} />
            <Text size={11} color={t.c.muted}>
              {s.charAt(0) + s.slice(1).toLowerCase()} {counts[s] ? `· ${counts[s]}` : ''}
            </Text>
          </View>
        ))}
      </View>
      {detail && detail.entries.length > 0 && (
        <View style={{ gap: 4 }}>
          {detail.entries.map((e) => (
            <Text key={e.id} size={12} color={t.c.text}>
              • {e.status.toLowerCase()} ({e.part === 'full' ? 'full day' : e.part}) — {e.source === 'manual' ? (e.note ?? 'set by you') : `from ${e.source}`}
            </Text>
          ))}
        </View>
      )}
      <View style={styles.actions}>
        <KButton label={selected.length ? `Set ${selected.length} day${selected.length > 1 ? 's' : ''}` : 'Select days to edit'} size="sm" disabled={!selected.length} onPress={() => setEditing(true)} style={{ flex: 1 }} />
        <KButton label="Weekly rules" size="sm" variant="secondary" icon="repeat" onPress={() => setRulesOpen(true)} style={{ flex: 1 }} />
      </View>

      <Sheet visible={editing} onClose={() => setEditing(false)} title={`${selected.length} day(s)`}>
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          <ChoiceChips options={['AVAILABLE', 'TENTATIVE', 'UNAVAILABLE']} selected={[status]} onToggle={(v) => setStatus(v as AvailabilityStatus)} />
          <ChoiceChips options={['full', 'morning', 'afternoon', 'evening']} selected={[part]} onToggle={(v) => setPart(v as DayPart)} />
          <KField placeholder="Note (e.g. family puja, travel)" value={note} onChangeText={setNote} />
          <Text size={12} color={t.c.muted}>
            Booked and held days come from confirmed bookings and can’t be changed here.
          </Text>
          <KButton
            label="Save"
            onPress={() => {
              setAvailability(ownerKind, ownerId, selected, status, part, note.trim() || undefined);
              setSelected([]);
              setEditing(false);
              setNote('');
              toast('Calendar updated', 'calendar');
            }}
          />
        </View>
      </Sheet>
      <Sheet visible={rulesOpen} onClose={() => setRulesOpen(false)} title="Recurring unavailability">
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <Text size={13} color={t.c.muted}>
            Tap a weekday to mark it unavailable every week (e.g. Saturdays off, Tuesday mornings for editing).
          </Text>
          {WEEKDAYS.map((w, i) => {
            const rule = myRules.find((r) => r.weekday === i);
            return (
              <Pressable key={w} onPress={() => (rule ? removeRule(rule.id) : addRule({ ownerId, weekday: i, status: 'UNAVAILABLE', part: 'full' }))} style={[styles.ruleRow, { borderColor: rule ? t.c.danger : t.c.border }]}>
                <Text size={15} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
                  Every {w}
                </Text>
                <Text size={12} color={rule ? t.c.danger : t.c.muted}>
                  {rule ? `Unavailable (${rule.part})` : 'Available'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  week: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  dot: { width: 5, height: 5, borderRadius: 3, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row', gap: 8 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 12, padding: 12 },
});
