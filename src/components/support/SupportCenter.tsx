import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Card, EmptyBlock, FilterChip, KButton, ListRow, SectionTitle, StackHeader } from '@/components/kit';
import { reportBug } from '@/components/ui/BugReporter';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { SearchBar } from '@/components/ui/SearchBar';
import { Text } from '@/components/ui/Text';
import { BRAND } from '@/constants/brand';
import { colors, themed } from '@/constants/theme';
import { faqFor, isOpenTicket, SUPPORT_TOPICS, supportHref, type FaqItem } from '@/data/support';
import { useFeatures } from '@/hooks/useFeatures';
import { useLayout } from '@/hooks/useLayout';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SupportTopic } from '@/types/platform';

import { TicketRow } from './parts';

type IconName = keyof typeof Ionicons.glyphMap;

/** Lower-case words of a question and its answer, for the search box. */
const matches = (item: FaqItem, query: string) => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = `${item.q} ${item.a}`.toLowerCase();
  return words.every((w) => text.includes(w));
};

function FaqRow({ item, open, onToggle, last }: { item: FaqItem; open: boolean; onToggle: () => void; last: boolean }) {
  const t = useRoleTheme();
  return (
    <View style={!last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.c.border }}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.faqQ, pressed && { backgroundColor: t.c.surfaceAlt }]}>
        <Text size={15} weight={open ? 'semibold' : 'medium'} color={t.c.textStrong} style={{ flex: 1 }}>
          {item.q}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={t.c.muted} />
      </Pressable>
      {open && (
        <Text size={14} color={t.c.text} lineHeight={21} style={styles.faqA}>
          {item.a}
        </Text>
      )}
    </View>
  );
}

function ContactTile({ icon, label, sub, onPress }: { icon: IconName; label: string; sub: string; onPress: () => void }) {
  const t = useRoleTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${sub}`}
      style={({ pressed }) => [styles.tile, { backgroundColor: t.c.surface, borderColor: t.c.border }, pressed && { backgroundColor: t.c.surfaceAlt }]}>
      <View style={[styles.tileIcon, { backgroundColor: t.c.soft }]}>
        <Ionicons name={icon} size={20} color={t.c.primary} />
      </View>
      <Text size={14} weight="semibold" color={t.c.textStrong} numberOfLines={1}>
        {label}
      </Text>
      <Text size={12} color={t.c.muted} numberOfLines={1}>
        {sub}
      </Text>
    </Pressable>
  );
}

/**
 * Help and support for couples, businesses and freelancers: how to reach the
 * team, the person's own requests, and answers to common questions. Staff
 * answer requests at Platform → Help desk.
 */
export function SupportCenter() {
  const t = useRoleTheme();
  const account = useAccount();
  const { wide } = useLayout();
  const on = useFeatures();
  const all = useDb((s) => s.supportTickets);
  const mine = all.filter((x) => x.accountId === account.id);
  const open = mine.filter((x) => isOpenTicket(x.status));
  const done = mine.filter((x) => !isOpenTicket(x.status));
  const [showDone, setShowDone] = useState(false);
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<SupportTopic | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const faq = faqFor(account.role).filter((f) => (!topic || f.topic === topic) && (!query.trim() || matches(f, query)));
  const topics = SUPPORT_TOPICS.filter((x) => faqFor(account.role).some((f) => f.topic === x.id));
  const first = account.name.split(/\s+/)[0] ?? '';
  const newRequest = (about?: SupportTopic) => router.push({ pathname: `${supportHref(account.role)}/new` as never, params: about ? { topic: about } : {} } as Href);
  const listed = showDone ? [...open, ...done] : open;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Help and support" subtitle="We reply 9am to 7pm, every day" />
      <ScrollView contentContainerStyle={[styles.body, wide && styles.bodyWide]} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { borderColor: colors.goldLine }]}>
          <Text serif size={22} weight="bold" color={colors.onDark} lineHeight={30}>
            {first ? `Namaste, ${first}` : 'Namaste'}
          </Text>
          <View style={[styles.rule, { backgroundColor: colors.gold }]} />
          <Text size={15} color={colors.onWineMuted}>
            How can we help today? Search the answers below, or ask the team directly.
          </Text>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search help, e.g. refund or payout" style={styles.search} />
        </View>

        <View style={styles.tiles}>
          <ContactTile icon="call-outline" label="Call us" sub="9am to 7pm" onPress={() => Linking.openURL(`tel:${BRAND.supportPhone}`).catch(() => {})} />
          <ContactTile icon="logo-whatsapp" label="WhatsApp" sub="Chat with the team" onPress={() => Linking.openURL(`https://wa.me/${BRAND.supportWhatsApp}`).catch(() => {})} />
          <ContactTile icon="mail-outline" label="Email" sub={BRAND.supportEmail} onPress={() => Linking.openURL(`mailto:${BRAND.supportEmail}`).catch(() => {})} />
          {account.role === 'customer' && on('couple.help') ? (
            <ContactTile icon="chatbubble-ellipses-outline" label={BRAND.assistantTitle} sub="Instant answers" onPress={() => router.push('/assistant')} />
          ) : (
            <ContactTile icon="create-outline" label="Write to us" sub="Get a reply in the app" onPress={() => newRequest()} />
          )}
        </View>

        <SectionTitle title="Your requests" action="New request" onAction={() => newRequest()} />
        {mine.length === 0 ? (
          <Card>
            <EmptyBlock icon="chatbubbles-outline" title="No requests yet" message="Ask us anything about a booking, a payment or your account. You’ll get a reply here and a notification." action="New request" onAction={() => newRequest()} />
          </Card>
        ) : (
          <Card padded={false} style={{ overflow: 'hidden' }}>
            {listed.length === 0 && (
              <Text size={14} color={t.c.muted} style={{ padding: 16 }}>
                Nothing open. Everything you asked has been answered.
              </Text>
            )}
            {listed.map((ticket, i) => (
              <TicketRow key={ticket.id} ticket={ticket} last={i === listed.length - 1 && !done.length} />
            ))}
            {done.length > 0 && (
              <Pressable onPress={() => setShowDone((v) => !v)} accessibilityRole="button" style={({ pressed }) => [styles.more, pressed && { backgroundColor: t.c.surfaceAlt }]}>
                <Text size={14} weight="semibold" color={t.c.primary}>
                  {showDone ? 'Hide solved requests' : `Show solved requests (${done.length})`}
                </Text>
              </Pressable>
            )}
          </Card>
        )}

        <SectionTitle title="Common questions" />
        <View style={styles.chips}>
          <FilterChip label="All" selected={!topic} onPress={() => setTopic(null)} />
          {topics.map((x) => (
            <FilterChip key={x.id} label={x.label} selected={topic === x.id} onPress={() => setTopic(topic === x.id ? null : x.id)} />
          ))}
        </View>
        <Card padded={false} style={{ overflow: 'hidden' }}>
          {faq.length === 0 ? (
            <View style={{ padding: 16, gap: 10 }}>
              <Text size={14} color={t.c.muted}>
                No answer matches that. Ask the team and we’ll reply here.
              </Text>
              <KButton label="Ask the team" icon="create-outline" size="sm" style={{ alignSelf: 'flex-start' }} onPress={() => newRequest(topic ?? undefined)} />
            </View>
          ) : (
            faq.map((item, i) => <FaqRow key={item.id} item={item} open={expanded === item.id || (!!query.trim() && faq.length <= 2)} onToggle={() => setExpanded(expanded === item.id ? null : item.id)} last={i === faq.length - 1} />)
          )}
        </Card>

        <Card style={styles.still}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text size={15} weight="semibold" color={t.c.textStrong}>
              Still need help?
            </Text>
            <Text size={13} color={t.c.muted}>
              Tell us what happened and we’ll take it from there.
            </Text>
          </View>
          <KButton label="Ask the team" icon="create-outline" size="sm" onPress={() => newRequest(topic ?? undefined)} />
        </Card>

        <SectionTitle title="More help" />
        <Card padded={false}>
          <ListRow icon="bug-outline" title="Report a problem with the app" subtitle="Sends a screenshot of what you see" onPress={() => void reportBug({ screenshot: false })} />
          <ListRow icon="receipt-outline" title="Cancellation and refunds" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'refunds' } })} />
          <ListRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'privacy' } })} />
          <ListRow icon="document-text-outline" title="Terms of use" onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: 'terms' } })} />
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = themed(() => StyleSheet.create({
  body: { padding: 16, gap: 14, paddingBottom: 60 },
  bodyWide: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingTop: 24 },
  hero: { backgroundColor: colors.wine, borderRadius: 12, borderWidth: 1, padding: 18, gap: 8 },
  rule: { width: 28, height: 1 },
  search: { marginTop: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', minWidth: 150, borderWidth: 1, borderRadius: 10, padding: 12, gap: 4 },
  tileIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  faqQ: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  faqA: { paddingHorizontal: 16, paddingBottom: 16, marginTop: -4 },
  more: { paddingHorizontal: 16, paddingVertical: 12 },
  still: { flexDirection: 'row', alignItems: 'center', gap: 12 },
}));
