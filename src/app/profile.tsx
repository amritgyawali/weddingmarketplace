import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BackButton } from '@/components/ui/IconButton';
import { Text } from '@/components/ui/Text';
import { colors, GUTTER } from '@/constants/theme';
import { useCustomerWorkspace } from '@/hooks/useWorkspace';
import { logout } from '@/services/auth';
import { selectUnreadCount, useAppStore } from '@/store/useAppStore';
import { useInbox } from '@/store/useDb';
import { useAccount } from '@/store/useSession';
import { confirm } from '@/utils/confirm';

const ICON = colors.textBody;

type IconName = ComponentProps<typeof Ionicons>['name'];

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

  const icon = (name: IconName) => <Ionicons name={name} size={21} color={ICON} />;
  const sections: { title: string; items: MenuItem[] }[] = [
    {
      title: 'Your wedding',
      items: [
        { label: 'My Wedding', icon: icon('heart-outline'), href: '/my-wedding', badge: awaitingQuotes },
        { label: 'Planning tools', icon: icon('construct-outline'), href: '/tools' },
        { label: 'Guests & RSVP', icon: icon('people-outline'), href: '/guests' },
        { label: 'Budget', icon: icon('wallet-outline'), href: '/budget' },
        { label: 'Checklist', icon: icon('checkbox-outline'), href: '/checklist' },
        { label: 'Invitations', icon: icon('mail-outline'), href: '/invitations' },
        { label: 'Wedding website', icon: icon('globe-outline'), href: '/website' },
        { label: 'Contracts', icon: icon('document-lock-outline'), href: '/contracts' },
      ],
    },
    {
      title: 'Bookings and messages',
      items: [
        { label: 'Notifications', icon: icon('notifications-outline'), href: '/notifications', badge: unreadNotifications },
        { label: 'Inbox', icon: icon('chatbubble-outline'), href: '/inbox', badge: unread },
        { label: 'Enquiries & bookings', icon: icon('receipt-outline'), href: '/bookings', badge: bookings },
        { label: 'Shortlist', icon: icon('bookmark-outline'), href: '/shortlist' },
        { label: 'Deals & offers', icon: icon('pricetags-outline'), href: '/deals' },
      ],
    },
    {
      title: 'Help',
      items: [
        { label: 'Planner packages', icon: icon('clipboard-outline'), href: '/genie' },
        { label: 'Quick help', icon: icon('chatbubble-ellipses-outline'), href: '/assistant' },
        { label: 'Contact support', icon: icon('call-outline'), href: { pathname: '/info/[slug]', params: { slug: 'support' } } },
      ],
    },
    {
      title: 'More',
      items: [
        { label: 'Join a wedding', icon: icon('enter-outline'), href: '/join-wedding' },
        { label: 'Write a review', icon: icon('create-outline'), href: '/write-review' },
        { label: 'Shop', icon: icon('bag-handle-outline'), href: { pathname: '/info/[slug]', params: { slug: 'shop' } } },
        { label: 'Promotions', icon: icon('megaphone-outline'), href: { pathname: '/info/[slug]', params: { slug: 'promotions' } } },
        { label: 'Settings', icon: icon('settings-outline'), href: '/settings' },
        { label: 'About Vivah', icon: icon('information-circle-outline'), href: { pathname: '/info/[slug]', params: { slug: 'information' } } },
      ],
    },
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
            <Text size={20} weight="semibold" color={colors.textBody}>
              {profile.name
                .split(/\s+/)
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </Text>
          ) : (
            <Ionicons name="person" size={30} color={colors.textSubtle} style={{ marginTop: 8 }} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text size={19} weight="semibold" color={colors.heading}>
            {profile.name || 'Guest'}
          </Text>
          <Text size={14} color={colors.textMuted}>
            Edit profile
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
      </Pressable>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 30 }}>
        {sections.map((section) => (
          <View key={section.title}>
            <Text size={13} weight="medium" color={colors.textMuted} style={styles.sectionTitle}>
              {section.title}
            </Text>
            {section.items.map((item, i) => (
              <Pressable
                key={item.label}
                onPress={() => router.push(item.href)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.bgSoft }]}>
                <View style={styles.icon}>{item.icon}</View>
                <View style={[styles.rowBody, i < section.items.length - 1 && styles.rowBorder]}>
                  <Text size={16} color={colors.text}>
                    {item.label}
                  </Text>
                  {!!item.badge && (
                    <View style={styles.badge}>
                      <Text size={12} weight="semibold" color={colors.white} lineHeight={15}>
                        {item.badge}
                      </Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.bgMuted,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: GUTTER },
  icon: { width: 24, alignItems: 'flex-start', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingRight: GUTTER,
    marginLeft: 14,
  },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
  sectionTitle: { paddingHorizontal: GUTTER, paddingTop: 22, paddingBottom: 4 },
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
