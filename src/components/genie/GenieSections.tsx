import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { photos } from '@/constants/images';
import { colors, GUTTER, radius, shadows } from '@/constants/theme';
import { GENIE_FEATURES } from '@/data/genie';
import type { Faq, GeniePackage, Testimonial } from '@/types';
import { formatIndianNumber, formatShortDate } from '@/utils/format';

const scriptFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia, serif' });

export function GenieHero() {
  return (
    <View style={styles.hero}>
      {/* Left-anchored crop keeps the couple in the right half, clear of the text fade. */}
      <Image source={photos.virtualPlanningCouple} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="left" />
      <LinearGradient
        colors={['rgba(255,255,255,0.97)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
        locations={[0, 0.42, 0.72]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroContent}>
        <View>
          <Text size={9} weight="extrabold" color={colors.primary} tracking={0.5}>
            {BRAND.name.toUpperCase()}
          </Text>
          <Text
            size={44}
            lineHeight={48}
            color={colors.primary}
            style={{ fontFamily: scriptFont, fontStyle: 'italic', fontWeight: '700', marginTop: -6 }}>
            genie
          </Text>
          <Text size={11} weight="semibold" color={colors.primary} style={{ marginTop: -4, marginLeft: 24 }}>
            {BRAND.genieTagline}
          </Text>
        </View>
        <Text size={18} weight="semibold" color={colors.textStrong} lineHeight={24} style={{ marginTop: 16 }}>
          The smart way to{'\n'}find venues & vendors{'\n'}for your wedding
        </Text>
        <View style={styles.features}>
          {GENIE_FEATURES.map((f) => (
            <View key={f.label} style={styles.feature}>
              <Ionicons name={f.icon} size={22} color={colors.primary} />
              <Text size={13} weight="semibold" color={colors.textStrong} lineHeight={16}>
                {f.label}
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
    <View style={[styles.card, shadows.card, active && { borderColor: colors.success, borderWidth: 1.5 }]}>
      {pkg.popular && (
        <View style={styles.popular}>
          <Text size={11} weight="bold" color={colors.white} tracking={0.5}>
            MOST POPULAR
          </Text>
        </View>
      )}
      <View style={styles.cardHead}>
        <Text size={21} weight="semibold" color={colors.heading} lineHeight={27} style={{ flex: 1 }}>
          {pkg.title}
        </Text>
        <View style={{ alignItems: 'flex-end' }}>
          <Text size={21} weight="bold" color={colors.primary}>
            ₹ {formatIndianNumber(pkg.price)}/-
          </Text>
          <Text size={15} color={colors.textMuted} style={{ textDecorationLine: 'line-through', marginTop: 2 }}>
            ₹ {formatIndianNumber(pkg.mrp)}/-
          </Text>
        </View>
      </View>
      <Text size={17} color={colors.textMuted} lineHeight={24} style={{ marginTop: 8, marginRight: 50 }}>
        {pkg.subtitle}
      </Text>
      <View style={styles.list}>
        {pkg.features.map((f) => (
          <View key={f} style={styles.li}>
            <Ionicons name="checkmark" size={20} color={colors.textStrong} style={{ marginTop: 1 }} />
            <Text size={15} color={colors.text} lineHeight={22} style={{ flex: 1 }}>
              {f}
            </Text>
          </View>
        ))}
      </View>
      {active ? (
        <View style={styles.activePlan}>
          <Ionicons name="checkmark-circle" size={20} color={colors.success} />
          <Text size={15} weight="semibold" color={colors.success}>
            Your active plan
          </Text>
        </View>
      ) : (
        <Button label={`Buy Now · Save ${discount}%`} onPress={onBuy} style={{ marginTop: 18 }} />
      )}
    </View>
  );
}

export function Testimonials({ items }: { items: Testimonial[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <View style={styles.block}>
      <Text size={24} weight="bold" color={colors.black} style={{ paddingHorizontal: GUTTER }}>
        Let them speak for us!
      </Text>
      <Text size={15} color={colors.textSubtle} style={{ paddingHorizontal: GUTTER, marginTop: 14, marginBottom: 12 }}>
        Some impressions from our customers
      </Text>
      {items.map((t) => {
        const expanded = open === t.id;
        return (
          <Animated.View key={t.id} layout={LinearTransition} style={styles.review}>
            <View style={styles.reviewHead}>
              <Text size={17} weight="semibold" color={colors.heading}>
                {t.couple}
              </Text>
              <Ionicons name="star" size={18} color={colors.star} />
              <Text size={14} color={colors.textBody}>
                {t.rating.toFixed(1)}
              </Text>
            </View>
            <Text size={14} color={colors.textMuted} style={{ marginTop: 4 }}>
              {formatShortDate(t.date)}
            </Text>
            <Text size={15} color={colors.text} lineHeight={22} style={{ marginTop: 10 }} numberOfLines={expanded ? undefined : 2}>
              {t.text}
            </Text>
            <Pressable onPress={() => setOpen(expanded ? null : t.id)} hitSlop={8}>
              <Text size={16} weight="semibold" color={colors.heading} style={{ marginTop: 2 }}>
                {expanded ? 'Read Less' : '...Read More'}
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
        <Text size={16} weight="semibold" color={colors.heading} style={{ flex: 1 }}>
          {faq.q}
        </Text>
        <Animated.View style={chevron}>
          <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
      {open && (
        <Animated.View entering={FadeIn}>
          <Text size={15} color={colors.textBody} lineHeight={22} style={{ paddingBottom: 14 }}>
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
      <Text size={24} weight="bold" color={colors.black} style={{ marginBottom: 8 }}>
        Frequently Asked Questions
      </Text>
      {items.map((f) => (
        <FaqItem key={f.id} faq={f} />
      ))}
      <View style={styles.helpRow}>
        <Button label="Call us" variant="outline" icon="call-outline" onPress={() => Linking.openURL(`tel:${BRAND.supportPhone}`)} style={{ flex: 1 }} />
        <Button label="Ask Wedika" variant="soft" icon="sparkles-outline" onPress={() => router.push('/assistant')} style={{ flex: 1 }} />
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
      style={[styles.wa, { bottom }, shadows.whatsappGlow]}>
      <Ionicons name="logo-whatsapp" size={34} color={colors.white} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  hero: { aspectRatio: 1 / 0.9, backgroundColor: '#EFECE8', overflow: 'hidden' },
  heroContent: { flex: 1, padding: GUTTER, paddingTop: 20, maxWidth: '60%' },
  features: { gap: 12, marginTop: 20 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  card: {
    marginHorizontal: 10,
    marginTop: 16,
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 20,
    paddingTop: 22,
  },
  popular: {
    position: 'absolute',
    top: -11,
    left: 20,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  list: { gap: 12, marginTop: 20 },
  li: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  activePlan: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 18, justifyContent: 'center' },
  block: { marginTop: 44 },
  review: {
    marginHorizontal: GUTTER - 8,
    paddingHorizontal: 8,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  faq: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  helpRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  wa: {
    position: 'absolute',
    right: 18,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.whatsapp,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
