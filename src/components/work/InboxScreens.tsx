import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { EmptyBlock, KButton, KField, StackHeader } from '@/components/kit';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Sheet } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useDb } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleTheme } from '@/theme/RoleTheme';
import { KeyboardAwareScrollView as ScrollView } from '@/components/ui/Keyboard';

import { InboxList } from './Collab';
import { ThreadView } from './ThreadView';

type Base = '/inbox' | '/business/inbox' | '/freelancer/inbox' | '/platform/inbox';

/** Conversation list screen for any role. */
export function InboxScreen({ basePath, customer }: { basePath: Base; customer?: boolean }) {
  const t = useRoleTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {customer ? <ScreenHeader title="Messages" /> : <StackHeader title="Messages" subtitle="Projects, services and enquiries" />}
      <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 40 }}>
        <InboxList basePath={basePath} />
      </ScrollView>
    </View>
  );
}

/** Single conversation screen for any role, with archive / mute / block / report. */
export function ThreadScreen({ customer }: { customer?: boolean }) {
  const t = useRoleTheme();
  const account = useAccount();
  const { id } = useLocalSearchParams<{ id: string }>();
  const thread = useDb((s) => s.threads.find((x) => x.id === id));
  const toggleFlag = useDb((s) => s.toggleThreadFlag);
  const report = useDb((s) => s.reportThread);
  const [menu, setMenu] = useState(false);
  const [reason, setReason] = useState('');

  if (!thread) {
    return (
      <View style={{ flex: 1, backgroundColor: t.c.bg }}>
        {customer ? <ScreenHeader title="Chat" /> : <StackHeader title="Chat" />}
        <EmptyBlock title="Conversation not found" />
      </View>
    );
  }

  const menuButton = (
    <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityLabel="Conversation options">
      <Ionicons name="ellipsis-vertical" size={20} color={t.c.textStrong} />
    </Pressable>
  );
  const subtitle = `${thread.kind === 'project' ? 'Project team' : thread.kind === 'service' ? 'Service chat' : thread.kind === 'direct' ? 'Direct enquiry' : thread.kind} · ${thread.members.length} members`;

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      {customer ? <ScreenHeader title={thread.title} subtitle={subtitle} right={menuButton} /> : <StackHeader title={thread.title} subtitle={subtitle} right={menuButton} />}
      <ThreadView thread={thread} />
      <Sheet visible={menu} onClose={() => setMenu(false)} title="Conversation">
        <View style={{ paddingHorizontal: 20, gap: 10 }}>
          <KButton
            label={thread.archivedBy.includes(account.id) ? 'Unarchive' : 'Archive'}
            variant="secondary"
            icon="archive-outline"
            onPress={() => {
              toggleFlag(thread.id, account.id, 'archivedBy');
              setMenu(false);
              router.back();
            }}
          />
          <KButton label={thread.mutedBy.includes(account.id) ? 'Unmute notifications' : 'Mute notifications'} variant="secondary" icon="notifications-off-outline" onPress={() => { toggleFlag(thread.id, account.id, 'mutedBy'); setMenu(false); }} />
          {thread.kind === 'direct' && (
            <KButton label={thread.blockedBy.includes(account.id) ? 'Unblock' : 'Block'} variant="danger" icon="ban-outline" onPress={() => { toggleFlag(thread.id, account.id, 'blockedBy'); setMenu(false); }} />
          )}
          <Text size={13} weight="semibold" color={t.c.muted}>
            Report a problem
          </Text>
          <KField placeholder="What’s wrong? (spam, abuse, off-platform payment request…)" value={reason} onChangeText={setReason} />
          <KButton
            label="Report to Vivah"
            variant="ghost"
            icon="flag-outline"
            disabled={!reason.trim()}
            onPress={() => {
              report(thread.id, { id: account.id, name: account.name, role: account.role }, reason.trim());
              setReason('');
              setMenu(false);
              toast('Reported — our team will review', 'flag');
            }}
          />
        </View>
      </Sheet>
    </View>
  );
}

