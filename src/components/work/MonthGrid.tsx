import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/Text';
import { bsMonthLabel } from '@/data/events';
import { useRoleTheme } from '@/theme/RoleTheme';
import { toISODate } from '@/utils/format';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Month calendar with coloured dots per day (events, payments, meetings…). */
export function MonthGrid({ marks, selected, onSelect, initial }: { marks: Record<string, string[]>; selected?: string; onSelect: (date: string) => void; initial?: string }) {
  const t = useRoleTheme();
  const start = initial ? new Date(`${initial}T00:00:00`) : new Date();
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();
  const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const iso = (d: number) => toISODate(new Date(cursor.y, cursor.m, d));
  const move = (delta: number) => setCursor(({ y, m }) => ({ y: m + delta < 0 ? y - 1 : m + delta > 11 ? y + 1 : y, m: (m + delta + 12) % 12 }));
  const todayIso = toISODate(new Date());

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.header}>
        <Pressable onPress={() => move(-1)} hitSlop={10} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={22} color={t.c.textStrong} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text size={16} weight="bold" color={t.c.textStrong}>
            {MONTHS[cursor.m]} {cursor.y}
          </Text>
          <Text size={11} color={t.c.muted}>
            {bsMonthLabel(iso(1))} → {bsMonthLabel(iso(days))}
          </Text>
        </View>
        <Pressable onPress={() => move(1)} hitSlop={10} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={22} color={t.c.textStrong} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} size={11} weight="semibold" color={t.c.muted} align="center" style={{ flex: 1 }}>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const date = iso(d);
          const dots = marks[date] ?? [];
          const on = selected === date;
          return (
            <Pressable key={i} onPress={() => onSelect(date)} style={styles.cell} accessibilityLabel={`${date}, ${dots.length} items`}>
              <View style={[styles.day, { backgroundColor: on ? t.c.primary : 'transparent', borderColor: date === todayIso && !on ? t.c.primary : 'transparent' }]}>
                <Text size={14} weight={on || dots.length ? 'bold' : 'regular'} color={on ? t.c.onPrimary : t.c.textStrong}>
                  {d}
                </Text>
                <View style={styles.dots}>
                  {dots.slice(0, 3).map((c, j) => (
                    <View key={j} style={[styles.dot, { backgroundColor: on ? t.c.onPrimary : c }]} />
                  ))}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  week: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dots: { flexDirection: 'row', gap: 2, height: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
