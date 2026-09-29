import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { colors } from '@/constants/theme';
import { VENUE_TYPES } from '@/data/venues';
import { DEFAULT_VENUE_FILTERS } from '@/services/api';
import type { VenueFilters, VenueType } from '@/types';
import { formatMoneyCompact } from '@/utils/format';

const SORTS: { id: VenueFilters['sort']; label: string }[] = [
  { id: 'popular', label: 'Popularity' },
  { id: 'rating', label: 'Rating' },
  { id: 'priceLow', label: 'Price: Low to High' },
  { id: 'priceHigh', label: 'Price: High to Low' },
];
const BUDGETS = [2_00_000, 5_00_000, 10_00_000, 20_00_000];
const GUESTS = [100, 300, 500, 1000];
const RATINGS = [4, 4.5];

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text weight="semibold" size={16} color={colors.heading}>
        {title}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

export function VenueFilterSheet({
  visible,
  value,
  onApply,
  onClose,
  resultCount,
}: {
  visible: boolean;
  value: VenueFilters;
  onApply: (f: VenueFilters) => void;
  onClose: () => void;
  resultCount?: number;
}) {
  const [draft, setDraft] = useState(value);
  const [wasVisible, setWasVisible] = useState(visible);
  // Start every opening from the currently applied filters.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setDraft(value);
  }

  const toggleType = (t: VenueType) =>
    setDraft((d) => ({ ...d, types: d.types.includes(t) ? d.types.filter((x) => x !== t) : [...d.types, t] }));

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Filters"
      footer={
        <View style={styles.footer}>
          <Button label="Reset" variant="outline" onPress={() => setDraft(DEFAULT_VENUE_FILTERS)} style={{ flex: 1 }} />
          <Button
            label={resultCount !== undefined ? 'Show venues' : 'Apply'}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={{ flex: 2 }}
          />
        </View>
      }>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Group title="Sort by">
          {SORTS.map((s) => (
            <Chip key={s.id} label={s.label} selected={draft.sort === s.id} onPress={() => setDraft((d) => ({ ...d, sort: s.id }))} />
          ))}
        </Group>
        <Group title="Venue type">
          {VENUE_TYPES.map((t) => (
            <Chip key={t} label={t} selected={draft.types.includes(t)} onPress={() => toggleType(t)} />
          ))}
        </Group>
        <Group title="Budget (up to)">
          {BUDGETS.map((b) => (
            <Chip
              key={b}
              label={formatMoneyCompact(b)}
              selected={draft.maxBudget === b}
              onPress={() => setDraft((d) => ({ ...d, maxBudget: d.maxBudget === b ? null : b }))}
            />
          ))}
        </Group>
        <Group title="Guests">
          {GUESTS.map((g) => (
            <Chip
              key={g}
              label={`${g}+ guests`}
              selected={draft.minGuests === g}
              onPress={() => setDraft((d) => ({ ...d, minGuests: d.minGuests === g ? null : g }))}
            />
          ))}
        </Group>
        <Group title="Rating">
          {RATINGS.map((r) => (
            <Chip
              key={r}
              label={`${r}★ & above`}
              selected={draft.minRating === r}
              onPress={() => setDraft((d) => ({ ...d, minRating: d.minRating === r ? null : r }))}
            />
          ))}
        </Group>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 12, gap: 22 },
  group: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
});
