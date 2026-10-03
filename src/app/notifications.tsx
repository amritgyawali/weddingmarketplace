import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { EmptyBlock, StackHeader } from '@/components/kit';
import { Text } from '@/components/ui/Text';
import { useDb, useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { useRoleFonts } from '@/theme/fonts';
import { RoleThemeProvider, useRoleTheme } from '@/theme/RoleTheme';
import { formatShortDate, formatTime } from '@/utils/format';

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/** Links are role-scoped; only follow ones that belong to the viewer's app. */
const canOpen = (href: string, role: string) =>
  role === 'vendor' ? href.startsWith('/business') : role === 'freelancer' ? href.startsWith('/freelancer') : role === 'platform' ? href.startsWith('/platform') : !/^\/(business|freelancer|platform)/.test(href);

function NotificationList() {
  const t = useRoleTheme();
  const account = useAccount();
  const inbox = useInbox(account);
  const markRead = useDb((s) => s.markNotificationsRead);

  // Mark everything read when leaving the screen, so unread items stay highlighted while viewing.
  useEffect(() => () => markRead(account), [account, markRead]);

  return (
    <View style={{ flex: 1, backgroundColor: t.c.bg }}>
      <StackHeader title="Notifications" subtitle={`${inbox.filter((n) => !n.read).length} unread`} />
      <FlatList
        data={[...inbox].sort((a, b) => b.at.localeCompare(a.at))}
        keyExtractor={(n) => n.id}
        style={{ backgroundColor: t.c.surface }}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<EmptyBlock icon="notifications-off-outline" title="You're all caught up" />}
        renderItem={({ item }) => {
          const openable = !!item.href && canOpen(item.href, account.role);
          return (
            <Pressable
              disabled={!openable}
              onPress={() => openable && router.push(item.href as Href)}
              style={({ pressed }) => [styles.item, { borderBottomColor: t.c.border }, pressed && { backgroundColor: t.c.surfaceAlt }]}>
              <View style={[styles.dot, { backgroundColor: item.read ? 'transparent' : t.c.primary }]} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text size={15} weight={item.read ? 'medium' : 'semibold'} color={t.c.textStrong}>
                  {item.title}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {item.body}
                </Text>
                <Text size={11} color={t.c.muted}>
                  {isToday(item.at) ? formatTime(item.at) : formatShortDate(item.at)}
                </Text>
              </View>
              {openable && <Ionicons name="chevron-forward" size={16} color={t.c.subtle} />}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

export default function NotificationsScreen() {
  const account = useAccount();
  // Opened from any role app (or a deep link), so load that role's typeface here too.
  const fontsReady = useRoleFonts(account.role);
  if (!fontsReady) return null;
  return (
    <RoleThemeProvider role={account.role}>
      <NotificationList />
    </RoleThemeProvider>
  );
}

const styles = StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingRight: 14, paddingLeft: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  dot: { width: 7, height: 7, borderRadius: 4, alignSelf: 'flex-start', marginTop: 7 },
});
