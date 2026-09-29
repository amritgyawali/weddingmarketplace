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
        contentContainerStyle={{ padding: 14, gap: 8, paddingBottom: 40 }}
        ListEmptyComponent={<EmptyBlock icon="notifications-off-outline" title="You're all caught up" />}
        renderItem={({ item }) => {
          const openable = !!item.href && canOpen(item.href, account.role);
          return (
            <Pressable
              disabled={!openable}
              onPress={() => openable && router.push(item.href as Href)}
              style={({ pressed }) => [
                styles.item,
                { backgroundColor: item.read ? t.c.surface : t.c.soft, borderColor: t.c.border, borderRadius: t.cardRadius, opacity: pressed ? 0.8 : 1 },
              ]}>
              <View style={[styles.icon, { backgroundColor: item.read ? t.c.surfaceAlt : t.c.primary }]}>
                <Ionicons name="notifications" size={16} color={item.read ? t.c.muted : t.c.onPrimary} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text size={14} weight={item.read ? 'semibold' : 'bold'} color={t.c.textStrong}>
                  {item.title}
                </Text>
                <Text size={13} color={t.c.muted}>
                  {item.body}
                </Text>
                <Text size={11} color={t.c.subtle}>
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
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderWidth: 1 },
  icon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
