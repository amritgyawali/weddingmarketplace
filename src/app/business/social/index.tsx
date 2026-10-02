import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { EmptyBlock, KButton, Segmented, StackHeader } from '@/components/kit';
import { SocialConversation, SocialInbox, openThreadRoute } from '@/components/social/Inbox';
import { SocialAccounts, SocialAutomation, SocialInsights } from '@/components/social/Panels';
import { useSocialWorkspace } from '@/components/social/parts';
import { composeHref, SocialCalendar, SocialPosts } from '@/components/social/Posts';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';
import { Text } from '@/components/ui/Text';
import { toast, toastError } from '@/components/ui/Toast';
import { socialLive, syncSocialFromServer } from '@/backend/social';
import { NETWORK_BY_ID } from '@/data/social';
import { useFeatures } from '@/hooks/useFeatures';
import { useLayout } from '@/hooks/useLayout';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import type { SocialNetwork } from '@/types/platform';

type Tab = 'inbox' | 'posts' | 'calendar' | 'accounts' | 'insights' | 'automation';
const TABS: { id: Tab; label: string }[] = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'posts', label: 'Posts' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'insights', label: 'Insights' },
  { id: 'automation', label: 'Automation' },
];

/**
 * Social media hub: Facebook, Instagram, WhatsApp and TikTok in one place.
 * One inbox for every message and comment, one composer for every network,
 * a content calendar, connected accounts, insights and automation.
 */
export default function SocialHub() {
  const t = useRoleTheme();
  const { wide } = useLayout();
  const on = useFeatures();
  const account = useAccount();
  const params = useLocalSearchParams<{ tab?: string; thread?: string; connected?: string; social_error?: string }>();
  const { threads, accounts, posts } = useSocialWorkspace(account);
  const runDue = useDb((s) => s.runDueSocialPosts);
  const [tab, setTab] = useState<Tab>(TABS.some((x) => x.id === params.tab) ? (params.tab as Tab) : accounts.some((a) => a.status !== 'disconnected') ? 'inbox' : 'accounts');
  const [selected, setSelected] = useState<string | undefined>(params.thread);

  // Demo: scheduled posts go out and snoozed threads come back while the hub is open (pg_cron does this on the
  // server). Supabase builds: read the hub from the server now and every 30 seconds.
  useEffect(() => {
    const tick = () => (socialLive() ? void syncSocialFromServer(account.id) : runDue());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, [runDue, account.id]);

  // Back from a network's consent page.
  useEffect(() => {
    if (params.connected) toast(`${NETWORK_BY_ID[params.connected as SocialNetwork]?.label ?? 'Account'} connected`, 'checkmark-circle');
    else if (params.social_error) toastError(params.social_error === 'access_denied' || params.social_error === 'cancelled' ? 'Connecting was cancelled' : params.social_error);
  }, [params.connected, params.social_error]);

  if (!on('vendor.social')) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        <StackHeader title="Social media" />
        <EmptyBlock icon="share-social-outline" title="Social media is switched off" message="The Vivah team has paused this feature for now." />
      </View>
    );
  }

  const unread = threads.reduce((s, x) => s + x.unread, 0);
  const failed = posts.filter((p) => p.status === 'failed' || p.status === 'partial').length;
  const expired = accounts.filter((a) => a.status === 'expired').length;
  const counts: Partial<Record<Tab, number>> = { inbox: unread || undefined, posts: failed || undefined, accounts: expired || undefined };
  const open = (id: string) => (wide ? setSelected(id) : openThreadRoute(id));
  const current = selected && threads.some((x) => x.id === selected) ? selected : wide ? threads.find((x) => x.status === 'open')?.id : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Social media" subtitle="Facebook, Instagram, WhatsApp and TikTok in one place" right={<KButton label="New post" size="sm" icon="create-outline" onPress={() => router.push(composeHref())} />} />
      <View style={styles.tabs}>
        <Segmented options={TABS} value={tab} onChange={setTab} counts={counts} />
      </View>
      {tab === 'posts' ? (
        <SocialPosts />
      ) : tab === 'inbox' ? (
        wide ? (
          <View style={styles.split}>
            <View style={[styles.list, { borderRightColor: t.c.border }]}>
              <SocialInbox onOpen={open} selectedId={current} />
            </View>
            <View style={{ flex: 1, backgroundColor: t.c.surface }}>
              {current ? (
                <SocialConversation key={current} threadId={current} />
              ) : (
                <EmptyBlock icon="chatbubbles-outline" title="Pick a conversation" message="Messages and comments from every network you connect show up on the left." />
              )}
            </View>
          </View>
        ) : (
          <SocialInbox onOpen={open} />
        )
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={wide ? { maxWidth: 1040, width: '100%', alignSelf: 'center' } : undefined}>
            {tab === 'calendar' && <SocialCalendar />}
            {tab === 'accounts' && <SocialAccounts />}
            {tab === 'insights' && <SocialInsights />}
            {tab === 'automation' && <SocialAutomation />}
          </View>
          {tab === 'accounts' && expired > 0 && (
            <Text size={12} color={t.c.muted} align="center" style={{ paddingHorizontal: 16 }}>
              Networks ask businesses to sign in again every few weeks. Reconnecting keeps your messages and posts.
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexShrink: 0 },
  split: { flex: 1, flexDirection: 'row' },
  list: { width: 400, borderRightWidth: StyleSheet.hairlineWidth },
});
