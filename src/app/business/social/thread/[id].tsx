import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { StackHeader } from '@/components/kit';
import { SocialConversation } from '@/components/social/Inbox';
import { NetworkIcon } from '@/components/social/parts';
import { NETWORK_BY_ID } from '@/data/social';
import { useDb } from '@/store/useDb';
import { useRoleTheme } from '@/theme/RoleTheme';

/** One social conversation on a phone (wide screens show it beside the inbox). */
export default function SocialThreadScreen() {
  const t = useRoleTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useDb((s) => s.socialThreads.find((x) => x.id === id));
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader
        title={thread?.contactName ?? 'Conversation'}
        subtitle={thread ? NETWORK_BY_ID[thread.network].label : undefined}
        right={thread ? <NetworkIcon network={thread.network} size={22} /> : undefined}
      />
      <SocialConversation threadId={id ?? ''} />
    </View>
  );
}
