import * as Linking from 'expo-linking';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Photo } from '@/components/ui/Photo';
import { PressableScale } from '@/components/ui/PressableScale';
import { Text } from '@/components/ui/Text';
import { photo } from '@/constants/images';
import { colors, GUTTER, radius } from '@/constants/theme';
import type { ContentBanner as Banner } from '@/types/content';

/** Opens a banner's link: a screen of the app, or a web address in the browser. */
export function openBannerLink(href: string) {
  if (href.startsWith('/')) router.push(href as Href);
  else Linking.openURL(href).catch(() => {});
}

/**
 * A banner a super admin added to the couple's home (Content studio → Home):
 * an optional photo, a title, a line of text and a link. The whole card is
 * one button when it has a link.
 */
export function ContentBanner({ banner }: { banner: Banner }) {
  const body = (
    <>
      {!!banner.image && <Photo source={photo(banner.image)} style={styles.image} contentFit="cover" />}
      <View style={styles.text}>
        <Text serif weight="bold" size={17} lineHeight={24} color={colors.heading} raw>
          {banner.title}
        </Text>
        {!!banner.body && (
          <Text size={14} lineHeight={20} color={colors.textMuted} raw>
            {banner.body}
          </Text>
        )}
        {!!banner.href && !!banner.actionLabel && (
          <Text size={14} weight="semibold" color={colors.primary} style={{ marginTop: 4 }} raw>
            {banner.actionLabel}
          </Text>
        )}
      </View>
    </>
  );
  const href = banner.href;
  return (
    <View style={styles.wrap}>
      {href ? (
        <PressableScale accessibilityRole="button" accessibilityLabel={banner.actionLabel ? `${banner.title}. ${banner.actionLabel}` : banner.title} onPress={() => openBannerLink(href)} style={styles.card}>
          {body}
        </PressableScale>
      ) : (
        <View style={styles.card}>{body}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 24, paddingHorizontal: GUTTER },
  card: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 2.2 },
  text: { padding: 14, gap: 4 },
});
