import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/IconButton';
import { GenieLampIcon } from '@/components/ui/Icons';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { logout } from '@/services/auth';
import { selectUnreadCount, useAppStore } from '@/store/useAppStore';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { confirm } from '@/utils/confirm';

const ICON = '#606266';

interface MenuItem {
  label: string;
  icon: ReactNode;
  href: Href;
  badge?: number;
}

export default function ProfileMenuScreen() {
  const insets = useSafeAreaInsets();
  const profile = useAppStore((s) => s.profile);
  const unread = useAppStore(selectUnreadCount);
  const bookings = useAppStore((s) => s.bookings.filter((b) => b.status !== 'cancelled').length);
  const account = useAccount();
  const { quotes } = useCustomerWorkspace(account.id);
  const awaitingQuotes = quotes.filter((q) => q.status === 'sent' || q.status === 'viewed').length;
  const unreadNotifications = useInbox(account).filter((n) => !n.read).length;

  const items: MenuItem[] = [
    { label: 'My Wedding', icon: <Ionicons name="heart-outline" size={24} color={ICON} />, href: '/my-wedding', badge: awaitingQuotes },
    { label: 'Notifications', icon: <Ionicons name="notifications-outline" size={24} color={ICON} />, href: '/notifications', badge: unreadNotifications },
    { label: 'Inbox', icon: <Ionicons name="mail-open-outline" size={24} color={ICON} />, href: '/inbox', badge: unread },
    { label: 'My Bookings', icon: <MaterialCommunityIcons name="calendar-check-outline" size={24} color={ICON} />, href: '/bookings', badge: bookings },
    { label: 'Checklist', icon: <MaterialCommunityIcons name="ring" size={22} color={ICON} />, href: '/checklist' },
    { label: 'Guests & RSVP', icon: <Ionicons name="people-circle-outline" size={24} color={ICON} />, href: '/guests' },
    { label: 'Budget', icon: <Ionicons name="wallet-outline" size={23} color={ICON} />, href: '/budget' },
    { label: 'Wedding website', icon: <Ionicons name="globe-outline" size={23} color={ICON} />, href: '/website' },
    { label: 'Invitations', icon: <MaterialCommunityIcons name="email-open-heart-outline" size={23} color={ICON} />, href: '/invitations' },
    { label: 'Shortlist', icon: <Ionicons name="bookmark-outline" size={23} color={ICON} />, href: '/shortlist' },
    { label: 'Contracts', icon: <Ionicons name="document-lock-outline" size={23} color={ICON} />, href: '/contracts' },
    { label: 'Deals & offers', icon: <Ionicons name="pricetags-outline" size={23} color={ICON} />, href: '/deals' },
    { label: 'Join a Wedding', icon: <Ionicons name="people-outline" size={24} color={ICON} />, href: '/join-wedding' },
    { label: 'Write a Review', icon: <MaterialCommunityIcons name="fountain-pen-tip" size={23} color={ICON} />, href: '/write-review' },
    { label: 'Packages', icon: <Ionicons name="gift-outline" size={23} color={ICON} />, href: '/genie' },
    { label: 'Genie Recommendations', icon: <GenieLampIcon size={25} color={ICON} />, href: '/assistant' },
    { label: 'Shop', icon: <Ionicons name="bag-handle-outline" size={23} color={ICON} />, href: { pathname: '/info/[slug]', params: { slug: 'shop' } } },
    { label: 'Promotions', icon: <Ionicons name="megaphone-outline" size={23} color={ICON} />, href: { pathname: '/info/[slug]', params: { slug: 'promotions' } } },
    { label: 'Settings', icon: <Ionicons name="settings-outline" size={23} color={ICON} />, href: '/settings' },
    { label: 'Contact Support', icon: <Ionicons name="call-outline" size={23} color={ICON} />, href: { pathname: '/info/[slug]', params: { slug: 'support' } } },
    { label: 'Information', icon: <Ionicons name="document-text-outline" size={23} color={ICON} />, href: { pathname: '/info/[slug]', params: { slug: 'information' } } },
  ];

  const confirmSignOut = () =>
    confirm('Log out?', 'Your shortlist, checklist and wedding plan stay saved for when you sign back in.', 'Log out', logout);

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: insets.top + 8, paddingHorizontal: GUTTER - 4 }}>
        <BackButton />
      </View>
      <Pressable onPress={() => router.push('/edit-profile')} style={styles.profile} accessibilityRole="button" accessibilityLabel="View profile">
        <View style={styles.avatar}>
          {profile.name ? (
            <Text size={24} weight="bold" color={colors.primary}>
              {profile.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          ) : (
            <Ionicons name="person" size={40} color="#C4C4C6" style={{ marginTop: 10 }} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text size={19} weight="semibold" color={colors.heading}>
            {profile.name || 'Guest'}
          </Text>
          <Text size={15} color={colors.textMuted}>
            View Profile
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        {items.map((item, i) => (
          <Pressable
            key={item.label}
            onPress={() => router.push(item.href)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
            <View style={styles.icon}>{item.icon}</View>
            <View style={[styles.rowBody, i < items.length - 1 && styles.rowBorder]}>
              <Text size={17} color={colors.text}>
                {item.label}
              </Text>
              {!!item.badge && (
                <View style={styles.badge}>
                  <Text size={12} weight="bold" color={colors.white} lineHeight={15}>
                    {item.badge}
                  </Text>
                </View>
              )}
            </View>
          </Pressable>
        ))}
        <Pressable onPress={confirmSignOut} style={styles.logout} accessibilityRole="button">
          <Ionicons name="log-out-outline" size={22} color={colors.danger} />
          <Text size={16} weight="medium" color={colors.danger}>
            Log out
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: GUTTER - 4,
    paddingTop: 22,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#D8D8DC',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E2E2E4',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: GUTTER - 4 },
  icon: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 17,
    paddingRight: GUTTER,
    marginLeft: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  logout: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: GUTTER, paddingTop: 26 },
});
