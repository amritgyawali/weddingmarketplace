import { Link, useLocalSearchParams } from 'expo-router';
import Head from 'expo-router/head';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { ENV } from '@/constants/env';
import { colors, GUTTER, themed } from '@/constants/theme';
import { isLegalDoc, LEGAL_DOCS, type LegalDocId } from '@/data/legal';
import { formatLongDate } from '@/utils/format';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

const OTHERS: { id: LegalDocId; label: string }[] = [
  { id: 'terms', label: 'Terms of use' },
  { id: 'privacy', label: 'Privacy policy' },
  { id: 'refunds', label: 'Cancellation and refunds' },
  { id: 'delete-account', label: 'Delete your account' },
];

/** Terms, privacy, refunds and account deletion: public pages, no sign-in needed (store listings and gateways link here). */
export default function LegalScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ doc?: string }>();
  const id: LegalDocId = isLegalDoc(params.doc) ? params.doc : 'terms';
  const doc = LEGAL_DOCS[id];

  return (
    <View style={styles.root}>
      <Head>
        <title>{`${doc.title} · ${BRAND.name}`}</title>
        <meta name="description" content={doc.summary} />
        <meta property="og:title" content={`${doc.title} · ${BRAND.name}`} />
        <meta property="og:description" content={doc.summary} />
        <link rel="canonical" href={`${ENV.appUrl.replace(/\/$/, '')}/legal/${id}`} />
      </Head>
      <ScreenHeader title={doc.title} />
      <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 40 }]}>
        <View style={styles.page}>
          <Text serif size={26} weight="bold" color={colors.heading} lineHeight={36} accessibilityRole="header">
            {doc.title}
          </Text>
          <Text size={13} color={colors.textMuted}>
            Last updated {formatLongDate(doc.updated)}
          </Text>
          {doc.sections.map((s) => (
            <View key={s.heading} style={styles.section}>
              <Text size={17} weight="semibold" color={colors.heading} accessibilityRole="header">
                {s.heading}
              </Text>
              {s.body.map((p) =>
                p.startsWith('- ') ? (
                  <View key={p} style={styles.bullet}>
                    <Text size={15} color={colors.textBody} lineHeight={23}>
                      {'•'}
                    </Text>
                    <Text size={15} color={colors.textBody} lineHeight={23} style={{ flex: 1 }}>
                      {p.slice(2)}
                    </Text>
                  </View>
                ) : (
                  <Text key={p} size={15} color={colors.textBody} lineHeight={23}>
                    {p}
                  </Text>
                ),
              )}
            </View>
          ))}
          <View style={[styles.section, styles.more]}>
            <Text size={13} weight="semibold" color={colors.textMuted}>
              Also read
            </Text>
            {OTHERS.filter((o) => o.id !== id).map((o) => (
              <Link key={o.id} href={{ pathname: '/legal/[doc]', params: { doc: o.id } }} replace style={styles.link}>
                <Text size={15} weight="medium" color={colors.primary}>
                  {o.label}
                </Text>
              </Link>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  body: { padding: GUTTER },
  // Readable line length on the web.
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: 8 },
  section: { gap: 8, marginTop: 18 },
  bullet: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  more: { borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 },
  link: { paddingVertical: 4 },
}));
