import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Card, KButton, ProgressBar } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { photos } from '@/constants/images';
import { colors } from '@/constants/theme';
import type { RegistryItem } from '@/types/platform';
import { formatMoney } from '@/utils/format';

export const REGISTRY_KINDS: { id: RegistryItem['kind']; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'cash', label: 'Cash fund', icon: 'cash-outline' },
  { id: 'honeymoon', label: 'Honeymoon fund', icon: 'airplane-outline' },
  { id: 'gift', label: 'Gift', icon: 'gift-outline' },
  { id: 'experience', label: 'Experience', icon: 'sparkles-outline' },
  { id: 'charity', label: 'Charity', icon: 'leaf-outline' },
  { id: 'external', label: 'Store wishlist', icon: 'open-outline' },
];

export const registryGoal = (r: RegistryItem) => r.target ?? (r.price ? r.price * (r.quantity ?? 1) : 0);
export const registryRaised = (r: RegistryItem) => r.contributions.reduce((s, c) => s + c.amount, 0);

/** One registry item with funding progress; used by the couple's manager and the public website. */
export function RegistryCard({ item, accent = colors.primary, onContribute, onPress }: { item: RegistryItem; accent?: string; onContribute?: () => void; onPress?: () => void }) {
  const goal = registryGoal(item);
  const raised = registryRaised(item);
  const kind = REGISTRY_KINDS.find((k) => k.id === item.kind)!;
  const funded = goal > 0 && raised >= goal;
  return (
    <Card padded={false} style={{ overflow: 'hidden' }}>
      <Pressable disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={item.title}>
      {item.image && <Image source={photos[item.image]} style={styles.image} contentFit="cover" />}
      <View style={{ padding: 14, paddingBottom: 0, gap: 8 }}>
        <View style={styles.row}>
          <Ionicons name={kind.icon} size={16} color={accent} />
          <Text size={12} weight="medium" color={accent}>
            {kind.label}
          </Text>
          {funded && (
            <Text size={12} weight="medium" color={colors.success}>
              · Fully funded
            </Text>
          )}
        </View>
        <Text size={16} weight="bold" color={colors.textStrong}>
          {item.title}
        </Text>
        {!!item.note && (
          <Text size={13} color={colors.textMuted}>
            {item.note}
          </Text>
        )}
        {goal > 0 && (
          <>
            <ProgressBar value={raised / goal} color={accent} />
            <Text size={12} color={colors.textMuted}>
              {formatMoney(raised)} of {formatMoney(goal)} · {item.contributions.length} gift{item.contributions.length === 1 ? '' : 's'}
            </Text>
          </>
        )}
      </View>
      </Pressable>
      <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 14 }}>
        {item.kind === 'external' && item.link ? (
          <KButton label="Open wishlist" icon="open-outline" variant="secondary" size="sm" onPress={() => Linking.openURL(item.link!)} />
        ) : (
          onContribute && !funded && <KButton label={item.kind === 'gift' ? 'Gift this' : 'Contribute'} icon="heart-outline" size="sm" onPress={onContribute} style={{ backgroundColor: accent, borderColor: accent }} />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 130 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
