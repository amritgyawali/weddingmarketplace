import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useRoleTheme } from '@/theme/RoleTheme';
import { bsMonthName, cursorFor, monthCells, shiftBsMonth, toNepaliDigits, WEEKDAYS_NE_SHORT, type MonthCell } from '@/utils/bs';
import { fromISODate, toISODate } from '@/utils/format';

import { Text } from './Text';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Saturdays and Sundays in Nepal's wedding seasons (Mangsir–Falgun, Baisakh). */
const isPeakDay = (d: Date) => [0, 6].includes(d.getDay()) && [9, 10, 11, 0, 1, 3].includes(d.getMonth());

/** Title and subtitle of a month cursor: "Mangsir 2083" over "Nov – Dec 2026", or the reverse in AD mode. */
export function useMonthTitle(mode: 'bs' | 'ad', cursor: { year: number; month: number }, cells: (MonthCell | null)[]) {
  const { lang } = useI18n();
  const n = (x: number) => (lang === 'ne' ? toNepaliDigits(x) : String(x));
  const days = cells.filter((c): c is MonthCell => !!c);
  const first = days[0]?.iso ?? toISODate(new Date());
  const last = days[days.length - 1]?.iso ?? first;
  if (mode === 'bs') {
    const a = fromISODate(first);
    const b = fromISODate(last);
    const sub = a.getFullYear() === b.getFullYear() ? `${MONTHS_SHORT[a.getMonth()]} – ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}` : `${MONTHS_SHORT[a.getMonth()]} ${a.getFullYear()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getFullYear()}`;
    return { title: `${bsMonthName(cursor.month, lang)} ${n(cursor.year)}`, subtitle: sub };
  }
  const bsStart = cursorFor('bs', first);
  const bsEnd = cursorFor('bs', last);
  return {
    title: `${MONTHS[cursor.month]} ${cursor.year}`,
    subtitle: `${bsMonthName(bsStart.month, lang)} – ${bsMonthName(bsEnd.month, lang)} ${n(bsEnd.year)}`,
  };
}

export const weekdayLetters = (lang: 'en' | 'ne') => (lang === 'ne' ? WEEKDAYS_NE_SHORT : WEEKDAYS);

/** Moves a month cursor in either calendar. */
export const shiftCursor = (mode: 'bs' | 'ad', c: { year: number; month: number }, delta: number) => {
  if (mode === 'bs') return shiftBsMonth(c, delta);
  const d = new Date(c.year, c.month + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
};

/**
 * Pure-JS month calendar so the date step looks the same on iOS, Android and
 * web. Shows the Nepali (BS) month by default with the AD day in small type;
 * the value is always an AD `yyyy-mm-dd`.
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
  const { calendar: mode, lang } = useI18n();
  const [cursor, setCursor] = useState(() => cursorFor(mode, value ?? toISODate(new Date())));
  const [cursorMode, setCursorMode] = useState(mode);
  // The calendar setting changed while open: re-anchor on the same day.
  if (cursorMode !== mode) {
    setCursorMode(mode);
    setCursor(cursorFor(mode, value ?? toISODate(new Date())));
  }

  const min = new Date(minDate);
  min.setHours(0, 0, 0, 0);
  const minIso = toISODate(min);
  const cells = monthCells(mode, cursor);
  const { title, subtitle } = useMonthTitle(mode, cursor, cells);
  const firstIso = cells.find((c) => c)?.iso ?? minIso;
  const canGoPrev = firstIso > minIso;
  const n = (x: number) => (lang === 'ne' && mode === 'bs' ? toNepaliDigits(x) : String(x));

  return (
    <View>
      <View style={styles.header}>
        <Pressable
          onPress={() => canGoPrev && setCursor((c) => shiftCursor(mode, c, -1))}
          hitSlop={12}
          accessibilityLabel="Previous month"
          style={({ pressed }) => [styles.nav, { backgroundColor: t.c.surfaceAlt }, !canGoPrev && { opacity: 0.3 }, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-back" size={20} color={t.c.text} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text weight="bold" size={17} color={t.c.textStrong} raw>
            {title}
          </Text>
          <Text size={12} color={t.c.muted} raw>
            {subtitle}
          </Text>
        </View>
        <Pressable
          onPress={() => setCursor((c) => shiftCursor(mode, c, 1))}
          hitSlop={12}
          accessibilityLabel="Next month"
          style={({ pressed }) => [styles.nav, { backgroundColor: t.c.surfaceAlt }, pressed && { opacity: 0.6 }]}>
          <Ionicons name="chevron-forward" size={20} color={t.c.text} />
        </Pressable>
      </View>

      <View style={styles.grid}>
        {weekdayLetters(lang).map((d, i) => (
          <View key={`${d}${i}`} style={styles.head}>
            <Text size={12} weight="semibold" color={i === 6 ? t.c.danger : t.c.muted} raw>
              {d}
            </Text>
          </View>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <View key={`e${i}`} style={styles.cell} />;
          const date = fromISODate(cell.iso);
          const disabled = cell.iso < minIso;
          const selected = cell.iso === value;
          const peak = !disabled && isPeakDay(date);
          const saturday = date.getDay() === 6;
          return (
            <Pressable
              key={cell.iso}
              disabled={disabled}
              onPress={() => onChange(cell.iso)}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={cell.iso}
              style={styles.cell}>
              {({ pressed }) => (
                <View style={[styles.day, selected && { backgroundColor: t.c.primary }, pressed && !selected && { backgroundColor: t.c.surfaceAlt }]}>
                  <Text
                    size={15}
                    lineHeight={19}
                    weight={selected ? 'bold' : 'medium'}
                    color={selected ? t.c.onPrimary : disabled ? t.c.border : saturday ? t.c.danger : t.c.text}
                    raw>
                    {n(cell.day)}
                  </Text>
                  <Text size={9} lineHeight={11} color={selected ? t.c.onPrimary : t.c.muted} raw>
                    {cell.alt}
                  </Text>
                  {peak && !selected && <View style={[styles.dot, styles.peakDot, { backgroundColor: t.c.primary }]} />}
                </View>
              )}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  head: { width: `${100 / 7}%`, height: 28, alignItems: 'center', justifyContent: 'center' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  peakDot: { position: 'absolute', bottom: 1 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, alignSelf: 'center' },
});
