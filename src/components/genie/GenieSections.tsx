import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius, shadows } from '@/constants/theme';
import { GENIE_FEATURES } from '@/data/genie';
import type { Faq, GeniePackage, Testimonial } from '@/types';
import { formatNumber, formatShortDate } from '@/utils/format';

/** Photo on top, then a plain statement of what the service does. */
export function GenieHero() {
  return (
    <View>
      <View style={styles.hero}>
        <Photo source={photos.virtualPlanningCouple} style={StyleSheet.absoluteFill} contentFit="cover" />
      </View>
      <View style={styles.heroContent}>
        <Text serif size={24} weight="bold" color={colors.heading} lineHeight={34}>
          A planner who makes the calls for you
        </Text>
        <Text size={15} color={colors.textBody} style={{ marginTop: 4 }}>
          Tell us the date, city and budget. Your planner shortlists venues and vendors, negotiates the price and books them.
        </Text>
        <View style={styles.features}>
          {GENIE_FEATURES.map((f) => (
            <View key={f.label} style={styles.feature}>
              <Ionicons name={f.icon} size={19} color={colors.textBody} />
              <Text size={14} color={colors.text} lineHeight={18}>
                {f.label.replace(/\n/g, ' ')}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export function PackageCard({ pkg, active, onBuy }: { pkg: GeniePackage; active?: boolean; onBuy: () => void }) {
  const discount = Math.round((1 - pkg.price / pkg.mrp) * 100);
  return (
    <View style={[styles.card, pkg.popular && { borderColor: colors.heading }, active && { borderColor: colors.success }]}>
      {pkg.popular && (
        <Text size={12} weight="semibold" color={colors.primary} style={{ marginBottom: 4 }}>
          Most couples choose this
        </Text>
      )}
      <View style={styles.cardHead}>
        <Text size={18} weight="semibold" color={colors.heading} lineHeight={24} style={{ flex: 1 }}>
          {pkg.title}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text size={18} weight="bold" color={colors.heading}>
            NPR {formatNumber(pkg.price)}
          </Text>
          <Text size={13} color={colors.textMuted} style={{ textDecorationLine: 'line-through' }}>
            NPR {formatNumber(pkg.mrp)}
          </Text>
        </View>
      </View>
      <Text size={14} color={colors.textMuted} lineHeight={20} style={{ marginTop: 2, marginRight: 60 }}>
        {pkg.subtitle}
      </Text>
      <View style={styles.list}>
        {pkg.features.map((f) => (
          <View key={f} style={styles.li}>
            <Ionicons name="checkmark" size={17} color={colors.success} style={{ marginTop: 2 }} />
            <Text size={14} color={colors.text} lineHeight={20} style={{ flex: 1 }}>
              {f}
            </Text>
          </View>
        ))}
      </View>
      {active ? (
        <View style={styles.activePlan}>
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text size={14} weight="semibold" color={colors.success}>
            Your current plan
          </Text>
        </View>
      ) : (
        <Button label={`Choose this plan · ${discount}% off`} variant={pkg.popular ? 'primary' : 'outline'} onPress={onBuy} style={{ marginTop: 16 }} />
      )}
    </View>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={styles.block}>
      <Text size={18} weight="bold" color={colors.heading} style={{ paddingHorizontal: GUTTER, marginBottom: 4 }}>
        From couples who used a planner
      </Text>
      {items.map((t) => {
        const expanded = open === t.id;
        return (
          <Animated.View key={t.id} layout={LinearTransition} style={styles.review}>
            <View style={styles.reviewHead}>
              <Text size={15} weight="semibold" color={colors.heading} style={{ flex: 1 }}>
                {t.couple}
              </Text>
              <Ionicons name="star" size={13} color={colors.star} />
              <Text size={13} color={colors.textBody}>
                {t.rating.toFixed(1)} · {formatShortDate(t.date)}
              </Text>
            </View>
            <Text size={14} color={colors.text} lineHeight={21} style={{ marginTop: 6 }} numberOfLines={expanded ? undefined : 3}>
              {t.text}
            </Text>
            <Pressable onPress={() => setOpen(expanded ? null : t.id)} hitSlop={8}>
              <Text size={14} weight="medium" color={colors.primary} style={{ marginTop: 4 }}>
                {expanded ? 'Show less' : 'Read more'}
              </Text>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

function FaqItem({ faq }: { faq: Faq }) {
  const [open, setOpen] = useState(false);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: withTiming(open ? '180deg' : '0deg') }] }));
  return (
    <Animated.View layout={LinearTransition} style={styles.faq}>
      <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.faqHead}>
        <Text size={15} weight="medium" color={colors.heading} style={{ flex: 1 }}>
          {faq.q}
        </Text>
        <Animated.View style={chevron}>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn}>
          <Text size={14} color={colors.textBody} lineHeight={21} style={{ paddingBottom: 14 }}>
            {faq.a}
          </Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

export function Faqs({ items }: { items: Faq[] }) {
  return (
    <View style={[styles.block, { paddingHorizontal: GUTTER }]}>
      <Text size={18} weight="bold" color={colors.heading} style={{ marginBottom: 4 }}>
        Questions
      </Text>
      {items.map((f) => (
        <FaqItem key={f.id} faq={f} />
      ))}
      <View style={styles.helpRow}>
        <Button label="Call us" variant="outline" icon="call-outline" onPress={() => Linking.openURL(`tel:${BRAND.supportPhone}`)} style={{ flex: 1 }} />
        <Button label="Ask a question" variant="outline" icon="chatbubble-outline" onPress={() => router.push('/assistant')} style={{ flex: 1 }} />
      </View>
    </View>
  );
}

export function WhatsAppFab({ bottom = 20 }: { bottom?: number }) {
  const message = encodeURIComponent(`Hi! I'd like to know more about ${BRAND.genieService}.`);
  return (
    <PressableScale
      haptic
      accessibilityLabel="Chat on WhatsApp"
      onPress={() =>
        Linking.openURL(`whatsapp://send?phone=${BRAND.supportWhatsApp}&text=${message}`).catch(() =>
          Linking.openURL(`https://wa.me/${BRAND.supportWhatsApp}?text=${message}`),
        )
      }
      style={[styles.wa, { bottom }, shadows.fab]}>
      <View style={styles.waMark}>
        <Ionicons name="logo-whatsapp" size={16} color={colors.whatsapp} />
      </View>
      <Text size={14} weight="semibold" color={colors.white}>
        WhatsApp us
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: { aspectRatio: 16 / 10, backgroundColor: colors.bgMuted, overflow: 'hidden' },
  heroContent: { paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 6 },
  features: { gap: 8, marginTop: 14 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  card: {
    marginHorizontal: GUTTER,
    marginTop: 12,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  list: { gap: 8, marginTop: 14 },
  li: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  activePlan: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16 },
  block: { marginTop: 36 },
  review: {
    marginHorizontal: GUTTER,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  faq: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  helpRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  wa: {
    position: 'absolute',
    right: 16,
    height: 46,
    borderRadius: 23,
    paddingLeft: 8,
    paddingRight: 18,
    flexDirection: 'row',
    gap: 9,
    backgroundColor: colors.wine,
    borderWidth: 1,
    borderColor: colors.goldLine,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** WhatsApp's own green, kept to a small mark on soft white so the pill stays on-palette. */
  waMark: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
});
