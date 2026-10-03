import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { shiftCursor, useMonthTitle, weekdayLetters } from '@/components/ui/Calendar';
import { Text } from '@/components/ui/Text';
import { useI18n } from '@/i18n';
import { useRoleTheme } from '@/theme/RoleTheme';
import { cursorFor, monthCells, toNepaliDigits } from '@/utils/bs';
import { toISODate } from '@/utils/format';

/** Month calendar with coloured dots per day (events, payments, meetings…). Nepali months by default. */
export function MonthGrid({ marks, selected, onSelect, initial }: { marks: Record<string, string[]>; selected?: string; onSelect: (date: string) => void; initial?: string }) {
  const t = useRoleTheme();
  const { calendar: mode, lang } = useI18n();
  const [cursor, setCursor] = useState(() => cursorFor(mode, initial ?? toISODate(new Date())));
  const [cursorMode, setCursorMode] = useState(mode);
  if (cursorMode !== mode) {
    setCursorMode(mode);
    setCursor(cursorFor(mode, selected ?? initial ?? toISODate(new Date())));
  }
  const cells = monthCells(mode, cursor);
  const { title, subtitle } = useMonthTitle(mode, cursor, cells);
  const todayIso = toISODate(new Date());
  const n = (x: number) => (lang === 'ne' && mode === 'bs' ? toNepaliDigits(x) : String(x));

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.header}>
        <Pressable onPress={() => setCursor((c) => shiftCursor(mode, c, -1))} hitSlop={12} accessibilityLabel="Previous month" style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Ionicons name="chevron-back" size={22} color={t.c.textStrong} />
        </Pressable>
        <View style={{ alignItems: 'center', flex: 1 }}>
          <Text size={16} weight="bold" color={t.c.textStrong} raw>
            {title}
          </Text>
          <Text size={11} color={t.c.muted} raw>
            {subtitle}
          </Text>
        </View>
        <Pressable onPress={() => setCursor((c) => shiftCursor(mode, c, 1))} hitSlop={12} accessibilityLabel="Next month" style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Ionicons name="chevron-forward" size={22} color={t.c.textStrong} />
        </Pressable>
      </View>
      <View style={styles.week}>
        {weekdayLetters(lang).map((w, i) => (
          <Text key={i} size={11} weight="semibold" color={i === 6 ? t.c.danger : t.c.muted} align="center" style={{ flex: 1 }} raw>
            {w}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={i} style={styles.cell} />;
          const dots = marks[cell.iso] ?? [];
          const on = selected === cell.iso;
          return (
            <Pressable key={cell.iso} onPress={() => onSelect(cell.iso)} style={styles.cell} accessibilityLabel={`${cell.iso}, ${dots.length} items`}>
              {({ pressed }) => (
                <View style={[styles.day, { backgroundColor: on ? t.c.primary : pressed ? t.c.surfaceAlt : 'transparent', borderColor: cell.iso === todayIso && !on ? t.c.primary : 'transparent' }]}>
                  <Text size={14} lineHeight={17} weight={on || dots.length ? 'bold' : 'regular'} color={on ? t.c.onPrimary : t.c.textStrong} raw>
                    {n(cell.day)}
                  </Text>
                  <Text size={8} lineHeight={10} color={on ? t.c.onPrimary : t.c.muted} raw>
                    {cell.alt}
                  </Text>
                  <View style={styles.dots}>
                    {dots.slice(0, 3).map((c, j) => (
                      <View key={j} style={[styles.dot, { backgroundColor: on ? t.c.onPrimary : c }]} />
                    ))}
                  </View>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  week: { flexDirection: 'row' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  day: { flex: 1, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  dots: { flexDirection: 'row', gap: 2, height: 5, marginTop: 1 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
