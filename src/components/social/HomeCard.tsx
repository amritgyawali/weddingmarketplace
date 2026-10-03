import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, KButton } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useFeatures } from '@/hooks/useFeatures';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { pluralize } from '@/utils/format';

import { NetworkIcon, useSocialSummary } from './parts';

/** Business home: social media at a glance, with the way into the inbox and the composer. */
export function SocialHomeCard() {
  const t = useRoleTheme();
  const on = useFeatures();
  const account = useAccount();
  const s = useSocialSummary(account);
  if (!on('vendor.social')) return null;

  const parts = [s.unread ? `${pluralize(s.unread, 'unread message')}` : 'No unread messages', s.scheduled ? `${pluralize(s.scheduled, 'post')} scheduled` : '', s.failed ? `${s.failed} need attention` : '', s.expired ? `${s.expired} to reconnect` : ''].filter(Boolean);

  return (
    <Card style={{ gap: 10 }}>
      <View style={styles.row}>
        <Text serif size={16} weight="semibold" color={t.c.textStrong} style={{ flex: 1 }}>
          Social media
        </Text>
        {s.networks.map((n) => (
          <NetworkIcon key={n} network={n} size={18} />
        ))}
      </View>
      {s.connected ? (
        <>
          <Text size={14} color={s.unread || s.failed || s.expired ? t.c.text : t.c.muted}>
            {parts.join(' · ')}
          </Text>
          <View style={styles.row}>
            <KButton label="Open inbox" size="sm" variant="secondary" icon="chatbubbles-outline" onPress={() => router.push({ pathname: '/business/social', params: { tab: 'inbox' } })} style={{ flex: 1 }} />
            <KButton label="New post" size="sm" icon="create-outline" onPress={() => router.push('/business/social/compose')} style={{ flex: 1 }} />
          </View>
        </>
      ) : (
        <>
          <Text size={14} color={t.c.muted}>
            Connect Facebook, Instagram, WhatsApp and TikTok to answer every message here and post to all of them at once.
          </Text>
          <KButton label="Connect accounts" size="sm" icon="link-outline" onPress={() => router.push({ pathname: '/business/social', params: { tab: 'accounts' } })} />
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
