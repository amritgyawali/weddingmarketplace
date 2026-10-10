import { Ionicons } from '@expo/vector-icons';
import { Photo } from '@/components/ui/Photo';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { BRAND } from '@/constants/brand';
import { photo, type PhotoKey } from '@/constants/images';
import { colors, GUTTER, radius, shadows } from '@/constants/theme';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

type IconName = ComponentProps<typeof Ionicons>['name'];

function Row({ icon, title, subtitle, onPress }: { icon: IconName; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text size={16} weight="medium" color={colors.heading}>
          {title}
        </Text>
        {subtitle && (
          <Text size={13} color={colors.textMuted}>
            {subtitle}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSubtle} />
    </Pressable>
  );
}

const INVITE_TEMPLATES: { id: string; title: string; image: PhotoKey; price: string }[] = [
  { id: 'royal', title: 'Royal Marigold', image: 'decorMandapNight', price: 'Free' },
  { id: 'pastel', title: 'Pastel Garden', image: 'decorMandapFloral', price: 'NPR 499' },
  { id: 'beach', title: 'Sunset Beach', image: 'venueDestinationBeach', price: 'NPR 799' },
  { id: 'video', title: 'Cinematic Video Invite', image: 'ideaCoupleGardenWalk', price: 'NPR 1,999' },
];

const PROMOTIONS: { title: string; code: string; detail: string }[] = [
  { title: '10% off Genie packages', code: 'SHUBH10', detail: 'Valid on all virtual planning packages' },
  { title: '15% off for first-time planners', code: 'FIRSTWED', detail: 'Applicable on your first Genie purchase' },
  { title: 'Free digital card', code: 'with Destination package', detail: 'Bonus included automatically' },
];

const SHOP: { title: string; image: PhotoKey; price: string }[] = [
  { title: 'Bridal Jewellery Sets', image: 'makeupBridePortrait', price: 'From NPR 7,999' },
  { title: 'Wedding Favours & Hampers', image: 'ideaReceptionToast', price: 'From NPR 450' },
  { title: 'Mehendi Ceremony Decor Kit', image: 'mehndiHands', price: 'From NPR 3,999' },
  { title: 'Mandap & Jagge Floral Packages', image: 'decorMandapFloral', price: 'From NPR 39,999' },
];

export default function InfoScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();

  const content = (() => {
    switch (slug) {
      case 'e-invites':
        return {
          title: 'e-invites',
          body: (
            <>
              <Text size={15} color={colors.textBody} lineHeight={22}>
                Design beautiful digital cards & video invites and share them on WhatsApp in minutes.
              </Text>
              <View style={styles.grid}>
                {INVITE_TEMPLATES.map((t) => (
                  <Pressable key={t.id} style={[styles.tile, shadows.card]} onPress={() => toast(`${t.title} template selected`, 'sparkles')}>
                    <Photo source={photo(t.image)} style={styles.tileImage} contentFit="cover" />
                    <View style={{ padding: 10 }}>
                      <Text size={14} weight="semibold" color={colors.heading} numberOfLines={1}>
                        {t.title}
                      </Text>
                      <Text size={13} weight="bold" color={colors.primary}>
                        {t.price}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </>
          ),
        };
      case 'shop':
        return {
          title: 'Shop',
          body: (
            <View style={styles.grid}>
              {SHOP.map((s) => (
                <Pressable key={s.title} style={[styles.tile, shadows.card]} onPress={() => toast('Shop launching soon — stay tuned!', 'bag-handle')}>
                  <Photo source={photo(s.image)} style={styles.tileImage} contentFit="cover" />
                  <View style={{ padding: 10 }}>
                    <Text size={14} weight="semibold" color={colors.heading} numberOfLines={2}>
                      {s.title}
                    </Text>
                    <Text size={13} color={colors.textMuted}>
                      {s.price}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          ),
        };
      case 'promotions':
        return {
          title: 'Promotions',
          body: (
            <View style={{ gap: 12 }}>
              {PROMOTIONS.map((p) => (
                <View key={p.title} style={styles.promo}>
                  <Ionicons name="pricetag" size={22} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text size={16} weight="semibold" color={colors.heading}>
                      {p.title}
                    </Text>
                    <Text size={13} color={colors.textMuted}>
                      {p.detail}
                    </Text>
                    <Text size={13} weight="bold" color={colors.primary} style={{ marginTop: 4 }}>
                      Code: {p.code}
                    </Text>
                  </View>
                </View>
              ))}
              <Button label="Explore Genie packages" onPress={() => router.navigate('/genie')} style={{ marginTop: 8 }} />
            </View>
          ),
        };
      case 'support':
        return {
          title: 'Contact Support',
          body: (
            <View>
              <Text size={15} color={colors.textBody} lineHeight={22} style={{ marginBottom: 12 }}>
                We’re here 9 AM – 9 PM, all days. Typical response time is under 30 minutes.
              </Text>
              <Row icon="call-outline" title="Call us" subtitle={BRAND.supportPhone} onPress={() => Linking.openURL(`tel:${BRAND.supportPhone}`)} />
              <Row
                icon="logo-whatsapp"
                title="WhatsApp"
                subtitle="Chat with our team"
                onPress={() => Linking.openURL(`https://wa.me/${BRAND.supportWhatsApp}`)}
              />
              <Row icon="mail-outline" title="Email" subtitle={BRAND.supportEmail} onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}`)} />
              <Row icon="sparkles-outline" title={`Ask ${BRAND.assistantTitle}`} subtitle="Instant answers, 24x7" onPress={() => router.push('/assistant')} />
            </View>
          ),
        };
      default:
        return {
          title: 'Information',
          body: (
            <View>
              <Row icon="document-text-outline" title="Terms of use" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
              <Row icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
              <Row icon="receipt-outline" title="Cancellation and refunds" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'refunds' } })} />
              <Row icon="help-circle-outline" title="FAQs" onPress={() => router.navigate('/genie')} />
              <Row icon="storefront-outline" title="List your business" subtitle="Are you a vendor? Join us" onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}?subject=Vendor%20listing`)} />
              <Text size={12} color={colors.textMuted} align="center" style={{ marginTop: 30 }}>
                {BRAND.name} v{Constants.expoConfig?.version ?? '1.0.0'}
              </Text>
            </View>
          ),
        };
    }
  })();

  return (
    <View style={styles.root}>
      <ScreenHeader title={content.title} />
      <ScrollView contentContainerStyle={styles.body}>{content.body}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER, gap: 16, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between' },
  tile: { width: '48%', backgroundColor: colors.white, borderRadius: radius.md, overflow: 'hidden' },
  tileImage: { width: '100%', aspectRatio: 1 },
  promo: { flexDirection: 'row', gap: 14, padding: 16, borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, backgroundColor: colors.primaryTint },
});
