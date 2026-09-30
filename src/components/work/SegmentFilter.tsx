import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { ONBOARDING_CITIES } from '@/data/cities';
import { TRADE_BY_ID, TRADES } from '@/data/trades';
import { segmentLabel, type Segment } from '@/services/segments';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';

const ALL = 'All';

/**
 * Occasion × trade × city filter for console lists. Collapsed it shows the
 * current segment in one line; `dims` picks which of the three a list offers.
 */
export function SegmentFilter({ value, onChange, dims = ['occasion', 'trade', 'city'] }: { value: Segment; onChange: (s: Segment) => void; dims?: ('occasion' | 'trade' | 'city')[] }) {
  const t = useRoleTheme();
  const occasions = useDb((s) => s.occasions);
  const [open, setOpen] = useState(false);
  const occasionName = occasions.find((o) => o.id === value.occasion)?.label;
  const label = segmentLabel(value, { occasion: occasionName, trade: value.trade ? TRADE_BY_ID[value.trade].label : undefined });
  const sorted = [...occasions].sort((a, b) => a.order - b.order);
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: open }} hitSlop={6} style={{ flex: 1 }}>
          <Text size={13} weight="medium" color={t.c.primary}>
            {label ? `Segment: ${label}` : 'Filter by segment'}
          </Text>
        </Pressable>
        {label && (
          <Pressable onPress={() => onChange({})} accessibilityRole="button" hitSlop={6}>
            <Text size={13} color={t.c.muted}>
              Clear
            </Text>
          </Pressable>
        )}
      </View>
      {open && (
        <View style={{ gap: 8 }}>
          {dims.includes('occasion') && (
            <ChoiceChips options={[ALL, ...sorted.map((o) => o.label)]} selected={[occasionName ?? ALL]} onToggle={(l) => onChange({ ...value, occasion: sorted.find((o) => o.label === l)?.id })} />
          )}
          {dims.includes('trade') && (
            <ChoiceChips options={[ALL, ...TRADES.map((x) => x.label)]} selected={[value.trade ? TRADE_BY_ID[value.trade].label : ALL]} onToggle={(l) => onChange({ ...value, trade: TRADES.find((x) => x.label === l)?.id })} />
          )}
          {dims.includes('city') && <ChoiceChips options={[ALL, ...ONBOARDING_CITIES]} selected={[value.city ?? ALL]} onToggle={(c) => onChange({ ...value, city: c === ALL ? undefined : c })} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
