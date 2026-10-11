import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShortlistButton } from '@/components/listing/ShortlistButton';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER, radius, shadows, themed } from '@/constants/theme';
import type { Review } from '@/types';
import { formatShortDate } from '@/utils/format';

/** Floating back / share / save controls over a hero image. */
export function HeroControls({ kind, id, shareText }: { kind: 'venues' | 'vendors'; id: string; shareText: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.controls, { top: insets.top + 8, pointerEvents: 'box-none' }]}>
      <IconButton
        icon="chevron-back"
        size={38}
        background={colors.white}
        accessibilityLabel="Go back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        style={shadows.card}
      />
      <View style={styles.controlsRight}>
        <IconButton
          icon="share-social-outline"
          size={38}
          background={colors.white}
          accessibilityLabel="Share"
          onPress={() => Share.share({ message: shareText }).catch(() => {})}
          style={shadows.card}
        />
        <ShortlistButton kind={kind} id={id} size={38} />
      </View>
    </View>
  );
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text size={18} weight="bold" color={colors.heading}>
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

export function ExpandableText({ text, lines = 4 }: { text: string; lines?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Text size={15} color={colors.textBody} lineHeight={23} numberOfLines={open ? undefined : lines}>
        {text}
      </Text>
      <Text size={14} weight="medium" color={colors.primary} onPress={() => setOpen((o) => !o)} style={{ marginTop: 6 }}>
        {open ? 'Read less' : 'Read more'}
      </Text>
    </View>
  );
}

export function ReviewList({ reviews, rating, count, onWrite }: { reviews: Review[]; rating: number; count: number; onWrite: () => void }) {
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? reviews : reviews.slice(0, 2);
  return (
    <View>
      <View style={styles.ratingSummary}>
        <View style={styles.ratingBig}>
          <Text serif size={34} weight="bold" color={colors.heading} lineHeight={42}>
            {rating.toFixed(1)}
          </Text>
          <View style={{ flexDirection: 'row' }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Ionicons key={n} name={n <= Math.round(rating) ? 'star' : 'star-outline'} size={12} color={colors.star} />
            ))}
          </View>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={15} weight="semibold" color={colors.heading}>
            {count} reviews
          </Text>
          <Text size={13} color={colors.textMuted}>
            Only couples who booked through Vivah can review.
          </Text>
          <Button label="Write a review" variant="outline" size="sm" icon="create-outline" onPress={onWrite} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
        </View>
      </View>
      {visible.map((r) => (
        <View key={r.id} style={styles.review}>
          <View style={styles.reviewHead}>
            <View style={styles.reviewAvatar}>
              <Text size={14} weight="semibold" color={colors.textBody}>
                {r.author[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text size={15} weight="semibold" color={colors.heading}>
                {r.author}
              </Text>
              <Text size={12} color={colors.textMuted}>
                {formatShortDate(r.date)}
              </Text>
            </View>
            <View style={styles.pill}>
              <Ionicons name="star" size={12} color={colors.star} />
              <Text size={13} weight="medium" color={colors.heading}>
                {r.rating.toFixed(1)}
              </Text>
            </View>
          </View>
          <Text size={14} color={colors.textBody} lineHeight={21} style={{ marginTop: 8 }}>
            {r.text}
          </Text>
        </View>
      ))}
      {reviews.length > 2 && (
        <Text size={14} weight="medium" color={colors.primary} onPress={() => setShowAll((v) => !v)} style={{ marginTop: 12 }}>
          {showAll ? 'Show fewer reviews' : `Show all ${reviews.length} reviews`}
        </Text>
      )}
    </View>
  );
}

export function StickyCta({
  priceLabel,
  price,
  unit,
  cta,
  onPress,
}: {
  priceLabel: string;
  price: string;
  unit: string;
  cta: string;
  onPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sticky, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={{ flex: 1 }}>
        <Text size={12} color={colors.textMuted}>
          {priceLabel}
        </Text>
        <Text size={18} weight="semibold" color={colors.textStrong}>
          {price}{' '}
          <Text size={12} color={colors.textMuted}>
            {unit}
          </Text>
        </Text>
      </View>
      <Button label={cta} onPress={onPress} style={{ paddingHorizontal: 26 }} />
    </View>
  );
}

export function InfoTile({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={styles.tile}>
      <Ionicons name={icon} size={19} color={colors.textMuted} />
      <Text size={12} color={colors.textMuted}>
        {label}
      </Text>
      <Text size={15} weight="semibold" color={colors.heading} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  controls: {
    position: 'absolute',
    left: GUTTER - 4,
    right: GUTTER - 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  controlsRight: { flexDirection: 'row', gap: 10 },
  section: { paddingHorizontal: GUTTER, paddingTop: 26, paddingBottom: 4 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  ratingSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingBottom: 14,
    marginBottom: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  ratingBig: { alignItems: 'center', paddingRight: 16, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: colors.border },
  review: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sticky: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tile: {
    flex: 1,
    minWidth: '45%',
    gap: 3,
    padding: 12,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
}));
