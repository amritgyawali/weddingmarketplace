import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useRoleTheme } from '@/theme/RoleTheme';
import { fromISODate, toISODate } from '@/utils/format';

import { Text } from './Text';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** Auspicious-looking highlight: weekends in peak wedding season (Oct–Feb). */
const isPeakDay = (d: Date) => [0, 6].includes(d.getDay()) && [9, 10, 11, 0, 1].includes(d.getMonth());

/**
 * Pure-JS month calendar so the date step looks identical on iOS, Android
 * and web (native pickers can't be themed to the brand pink).
 */
export function Calendar({
  value,
  onChange,
  minDate = new Date(),
}: {
  value: string | null;
  onChange: (iso: string) => void;
  minDate?: Date;
}) {
  const t = useRoleTheme();
  const initial = value ? fromISODate(value) : new Date();
  const [cursor, setCursor] = useState({ y: initial.getFullYear(), m: initial.getMonth() });

  const min = new Date(minDate);
  min.setHours(0, 0, 0, 0);
  const firstWeekday = new Date(cursor.y, cursor.m, 1).getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const canGoPrev = cursor.y > min.getFullYear() || (cursor.y === min.getFullYear() && cursor.m > min.getMonth());
  const shift = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          onPress={() => canGoPrev && shift(-1)}
          hitSlop={12}
          accessibilityLabel="Previous month"
          style={[styles.nav, { backgroundColor: t.c.surfaceAlt }, !canGoPrev && { opacity: 0.3 }]}>
          <Ionicons name="chevron-back" size={20} color={t.c.text} />
        </Pressable>
        <Text weight="bold" size={17} color={t.c.textStrong}>
          {MONTHS[cursor.m]} {cursor.y}
        </Text>
        <Pressable onPress={() => shift(1)} hitSlop={12} accessibilityLabel="Next month" style={[styles.nav, { backgroundColor: t.c.surfaceAlt }]}>
          <Ionicons name="chevron-forward" size={20} color={t.c.text} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {WEEKDAYS.map((d, i) => (
          <View key={`${d}${i}`} style={styles.cell}>
            <Text size={12} weight="semibold" color={t.c.muted}>
              {d}
            </Text>
          </View>
        ))}
        {cells.map((day, i) => {
          if (!day) return <View key={`e${i}`} style={styles.cell} />;
          const date = new Date(cursor.y, cursor.m, day);
          const iso = toISODate(date);
          const disabled = date < min;
          const selected = iso === value;
          const peak = !disabled && isPeakDay(date);
          return (
            <Pressable
              key={iso}
              disabled={disabled}
              onPress={() => onChange(iso)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={date.toDateString()}
              style={styles.cell}>
              <View style={[styles.day, selected && { backgroundColor: t.c.primary }]}>
                <Text
                  size={15}
                  weight={selected ? 'bold' : 'medium'}
                  color={selected ? t.c.onPrimary : disabled ? t.c.border : t.c.text}>
                  {day}
                </Text>
                {peak && !selected && <View style={[styles.dot, styles.peakDot, { backgroundColor: t.c.primary }]} />}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={[styles.dot, { backgroundColor: t.c.primary }]} />
        <Text size={12} color={t.c.muted}>
          Popular wedding dates
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  peakDot: { position: 'absolute', bottom: 3 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'center' },
});
